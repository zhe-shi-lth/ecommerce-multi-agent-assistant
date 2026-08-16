package com.lth.ecommerceagent.auth;

import java.time.Instant;
import java.util.*;
import com.lth.ecommerceagent.tenant.*;
import com.lth.ecommerceagent.user.*;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users; private final PasswordEncoder encoder; private final JwtService jwt;
    private final CompanyRepository companies; private final CompanyMemberRepository companyMembers; private final StoreRepository stores;
    private final StoreMemberRepository storeMembers; private final StoreMemberPermissionRepository permissions;
    public AuthController(UserRepository users,PasswordEncoder encoder,JwtService jwt,CompanyRepository companies,
            CompanyMemberRepository companyMembers,StoreRepository stores,StoreMemberRepository storeMembers,
            StoreMemberPermissionRepository permissions){this.users=users;this.encoder=encoder;this.jwt=jwt;this.companies=companies;this.companyMembers=companyMembers;this.stores=stores;this.storeMembers=storeMembers;this.permissions=permissions;}
    public record LoginRequest(String email,String password){} public record ContextRequest(Long companyId,Long storeId){}
    public record AuthResponse(String token,String role,String email,String displayName,Long userId,Long companyId,String companyName,Long storeId,String storeName,String memberRole,Set<String> permissions,List<CompanyOption> companies){}
    public record CompanyOption(Long id,String name,String role,List<StoreOption> stores){} public record StoreOption(Long id,String name,String code){}

    @PostMapping("/login") public ResponseEntity<?> login(@RequestBody LoginRequest r){
        if(r.email()==null||r.password()==null)return unauthorized(); User u=users.findByEmail(r.email().trim().toLowerCase()).orElse(null);
        if(u==null||!encoder.matches(r.password(),u.getPasswordHash()))return unauthorized();
        if(!"ACTIVE".equals(u.getStatus()))return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error","账号已停用，请联系管理员"));
        u.setLastLoginAt(Instant.now());users.save(u);
        var available=options(u.getId()); if("SUPER_ADMIN".equals(u.getRole()) || "PLATFORM_ADMIN".equals(u.getRole())) return ResponseEntity.ok(response(u,null,null,available));
        if(available.isEmpty())return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error","账号尚未加入任何企业"));
        if(available.getFirst().stores().size() > 1) return ResponseEntity.ok(response(u,available.getFirst().id(),null,available));
        if(available.getFirst().stores().isEmpty() && "OWNER".equals(available.getFirst().role())) return ResponseEntity.ok(response(u,available.getFirst().id(),null,available));
        if(available.getFirst().stores().isEmpty()) return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error","账号尚未加入任何店铺"));
        return ResponseEntity.ok(response(u,available.getFirst().id(),available.getFirst().stores().getFirst().id(),available));
    }
    @PostMapping("/context") public AuthResponse switchContext(@RequestBody ContextRequest r){User u=requireUser();return response(u,r.companyId(),r.storeId(),options(u.getId()));}
    @GetMapping("/me") public AuthResponse me(){User u=requireUser();var p=TenantContext.principal();return response(u,p==null?null:p.companyId(),p==null?null:p.storeId(),options(u.getId()));}
    private AuthResponse response(User u,Long companyId,Long storeId,List<CompanyOption> available){
        if(("SUPER_ADMIN".equals(u.getRole()) || "PLATFORM_ADMIN".equals(u.getRole()))&&companyId==null)return new AuthResponse(jwt.generateToken(new TenantPrincipal(u.getId(),u.getEmail(),u.getRole(),null,null,null,null,MemberRole.OWNER,EnumSet.allOf(Permission.class))),u.getRole(),u.getEmail(),u.getDisplayName(),u.getId(),null,null,null,null,"OWNER",names(Permission.values()),available);
        CompanyOption c=available.stream().filter(x->x.id().equals(companyId)).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"无权访问该企业"));
        if (storeId == null && "OWNER".equals(c.role())) {
            var cm = companyMembers.findByCompanyIdAndUserIdAndStatus(companyId,u.getId(),"ACTIVE").orElseThrow();
            var p = new TenantPrincipal(u.getId(),u.getEmail(),u.getRole(),companyId,c.name(),null,null,cm.getRole(),EnumSet.allOf(Permission.class));
            return new AuthResponse(jwt.generateToken(p),u.getRole(),u.getEmail(),u.getDisplayName(),u.getId(),companyId,c.name(),null,null,cm.getRole().name(),names(Permission.values()),available);
        }
        if (storeId == null) {
            var p = new TenantPrincipal(u.getId(),u.getEmail(),u.getRole(),companyId,c.name(),null,null,MemberRole.OPERATOR,Set.of());
            return new AuthResponse(jwt.generateToken(p),u.getRole(),u.getEmail(),u.getDisplayName(),u.getId(),companyId,c.name(),null,null,"OPERATOR",Set.of(),available);
        }
        StoreOption s=c.stores().stream().filter(x->x.id().equals(storeId)).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"无权访问该店铺"));
        var cm=companyMembers.findByCompanyIdAndUserIdAndStatus(companyId,u.getId(),"ACTIVE").orElse(null); var sm=storeMembers.findByStoreIdAndUserIdAndStatus(storeId,u.getId(),"ACTIVE").orElse(null);
        if (cm == null && sm == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"无权访问该店铺");
        MemberRole role=cm!=null?cm.getRole():MemberRole.OPERATOR; Set<Permission> ps=role==MemberRole.OWNER?EnumSet.allOf(Permission.class):permissions.findByStoreMemberId(sm.getId()).stream().map(StoreMemberPermission::getPermission).collect(java.util.stream.Collectors.toSet());
        var p=new TenantPrincipal(u.getId(),u.getEmail(),u.getRole(),companyId,c.name(),storeId,s.name(),role,ps);
        return new AuthResponse(jwt.generateToken(p),u.getRole(),u.getEmail(),u.getDisplayName(),u.getId(),companyId,c.name(),storeId,s.name(),role.name(),names(ps),available);
    }
    private List<CompanyOption> options(Long uid){
        Map<Long,CompanyOption> result=new LinkedHashMap<>();
        // 按用户 ID 过滤活动成员，避免不同数据库驱动/历史 schema 下派生查询条件未命中。
        companyMembers.findAll().stream().filter(cm->uid.equals(cm.getUserId())&&"ACTIVE".equals(cm.getStatus())).forEach(cm->{Company c=companies.findById(cm.getCompanyId()).filter(x->"ACTIVE".equals(x.getStatus())).orElse(null);if(c!=null)result.put(c.getId(),new CompanyOption(c.getId(),c.getName(),cm.getRole().name(),stores.findByCompanyIdAndStatusOrderByCreatedAt(c.getId(),"ACTIVE").stream().map(s->new StoreOption(s.getId(),s.getName(),s.getCode())).toList()));});
        storeMembers.findByUserIdAndStatus(uid,"ACTIVE").forEach(sm->{Company c=companies.findById(sm.getCompanyId()).filter(x->"ACTIVE".equals(x.getStatus())).orElse(null);if(c!=null&&!result.containsKey(c.getId()))result.put(c.getId(),new CompanyOption(c.getId(),c.getName(),"MEMBER",storeMembers.findByUserIdAndStatus(uid,"ACTIVE").stream().filter(x->x.getCompanyId().equals(c.getId())).map(x->stores.findById(x.getStoreId()).orElse(null)).filter(Objects::nonNull).map(s->new StoreOption(s.getId(),s.getName(),s.getCode())).toList()));});
        return new ArrayList<>(result.values());
    }
    private Set<String> names(Permission[] ps){return java.util.Arrays.stream(ps).map(Enum::name).collect(java.util.stream.Collectors.toSet());}
    private Set<String> names(Collection<Permission> ps){return ps.stream().map(Enum::name).collect(java.util.stream.Collectors.toSet());}
    private User requireUser(){var p=TenantContext.principal();if(p==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);return users.findById(p.userId()).orElseThrow();}
    private ResponseEntity<Map<String,String>> unauthorized(){return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error","账号或密码错误"));}
}
