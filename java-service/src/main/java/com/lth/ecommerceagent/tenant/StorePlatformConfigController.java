package com.lth.ecommerceagent.tenant;
import java.util.*; import com.fasterxml.jackson.core.type.TypeReference; import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.*; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.web.bind.annotation.*; import org.springframework.web.server.ResponseStatusException;
@RestController @RequestMapping("/api/store-platform-configs")
public class StorePlatformConfigController{
 private static final Set<String> PLATFORMS=Set.of("taobao","douyin","xiaohongshu");
 private final StorePlatformConfigRepository repo; private final CredentialCipher cipher; private final ObjectMapper json;
 public StorePlatformConfigController(StorePlatformConfigRepository r,CredentialCipher c,ObjectMapper j){repo=r;cipher=c;json=j;}
 public record ConfigRequest(Map<String,String> credentials,Boolean enabled){} public record ConfigView(String platform,boolean configured,boolean enabled,Set<String> credentialFields,java.time.Instant updatedAt){}
 @GetMapping @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER')") public List<ConfigView> list(){return repo.findByStoreIdOrderByPlatform(TenantContext.storeId()).stream().map(this::view).toList();}
 @PutMapping("/{platform}") @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER')") public ConfigView save(@PathVariable String platform,@RequestBody ConfigRequest request){
  if(!PLATFORMS.contains(platform))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"不支持的平台");StorePlatformConfig c=repo.findByStoreIdAndPlatform(TenantContext.storeId(),platform).orElseGet(StorePlatformConfig::new);
  c.setCompanyId(TenantContext.companyId());c.setStoreId(TenantContext.storeId());c.setPlatform(platform);
  if(request.credentials()!=null&&!request.credentials().isEmpty()){try{c.setCredentialsCiphertext(cipher.encrypt(json.writeValueAsString(request.credentials())));}catch(Exception e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"凭证格式无效");}}
  if(c.getCredentialsCiphertext()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"请填写平台凭证");c.setEnabled(request.enabled()==null||request.enabled());return view(repo.save(c));
 }
 @GetMapping("/internal/{platform}") @PreAuthorize("hasRole('SERVICE')") public Map<String,String> internal(@PathVariable String platform,@RequestHeader("X-Company-Id") Long companyId,@RequestHeader("X-Store-Id") Long storeId){
  StorePlatformConfig c=repo.findByStoreIdAndPlatform(storeId,platform).filter(x->x.getCompanyId().equals(companyId)&&x.isEnabled()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"当前店铺未配置平台凭证"));
  try{return json.readValue(cipher.decrypt(c.getCredentialsCiphertext()),new TypeReference<>(){});}catch(Exception e){throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,"平台凭证无法解密");}
 }
 private ConfigView view(StorePlatformConfig c){try{Map<String,String> m=json.readValue(cipher.decrypt(c.getCredentialsCiphertext()),new TypeReference<>(){});return new ConfigView(c.getPlatform(),true,c.isEnabled(),m.keySet(),c.getUpdatedAt());}catch(Exception e){return new ConfigView(c.getPlatform(),false,c.isEnabled(),Set.of(),c.getUpdatedAt());}}
}
