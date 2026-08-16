package com.lth.ecommerceagent.tenant;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

public final class TenantContext {
    private TenantContext() {}
    public static TenantPrincipal principal(){
        var auth=SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof TenantPrincipal p ? p : null;
    }
    public static long companyId(){var p=principal(); return p==null||p.companyId()==null?1L:p.companyId();}
    public static long storeId(){var p=principal(); return p==null||p.storeId()==null?1L:p.storeId();}
    public static boolean hasStoreContext(){var p=principal(); return p!=null && p.storeId()!=null;}
    public static Long userId(){var p=principal(); return p==null?null:p.userId();}
    public static void runAsSystem(long companyId,long storeId,Runnable action){
        var previous=SecurityContextHolder.getContext();
        var context=SecurityContextHolder.createEmptyContext();
        var principal=new TenantPrincipal(null,"SYSTEM","SUPER_ADMIN",companyId,"SYSTEM",storeId,"SYSTEM",MemberRole.OWNER,java.util.Set.of(Permission.values()));
        context.setAuthentication(new UsernamePasswordAuthenticationToken(principal,null,java.util.List.of(
                new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"),new SimpleGrantedAuthority("ROLE_OWNER"))));
        SecurityContextHolder.setContext(context);
        try{action.run();}finally{SecurityContextHolder.setContext(previous);}
    }
}
