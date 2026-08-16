package com.lth.ecommerceagent.tenant;

public record TenantPrincipal(Long userId, String email, String globalRole, Long companyId,
        String companyName, Long storeId, String storeName, MemberRole memberRole,
        java.util.Set<Permission> permissions) {
    public TenantPrincipal(Long userId, String email, String globalRole, Long companyId,
            String companyName, Long storeId, String storeName, MemberRole memberRole) {
        this(userId, email, globalRole, companyId, companyName, storeId, storeName, memberRole, java.util.Set.of());
    }
    public boolean isSuperAdmin(){ return "SUPER_ADMIN".equals(globalRole); }
    public boolean has(Permission permission){ return isSuperAdmin() || memberRole == MemberRole.OWNER || permissions.contains(permission); }
}
