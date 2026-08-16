package com.lth.ecommerceagent.tenant;
import java.nio.charset.StandardCharsets; import java.security.*; import java.util.Base64;
import javax.crypto.*; import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value; import org.springframework.stereotype.Component;
@Component
public class CredentialCipher{
 private final SecretKey key; private final SecureRandom random=new SecureRandom();
 public CredentialCipher(@Value("${tenant.credential-encryption-key:dev-platform-credential-key-change-me}") String secret){try{key=new SecretKeySpec(MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8)),"AES");}catch(Exception e){throw new IllegalStateException(e);}}
 public String encrypt(String plain){try{byte[] iv=new byte[12];random.nextBytes(iv);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key,new GCMParameterSpec(128,iv));byte[] encrypted=c.doFinal(plain.getBytes(StandardCharsets.UTF_8));byte[] all=new byte[iv.length+encrypted.length];System.arraycopy(iv,0,all,0,iv.length);System.arraycopy(encrypted,0,all,iv.length,encrypted.length);return Base64.getEncoder().encodeToString(all);}catch(Exception e){throw new IllegalStateException("平台凭证加密失败",e);}}
 public String decrypt(String value){try{byte[] all=Base64.getDecoder().decode(value);byte[] iv=java.util.Arrays.copyOfRange(all,0,12);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,iv));return new String(c.doFinal(java.util.Arrays.copyOfRange(all,12,all.length)),StandardCharsets.UTF_8);}catch(Exception e){throw new IllegalStateException("平台凭证解密失败",e);}}
}
