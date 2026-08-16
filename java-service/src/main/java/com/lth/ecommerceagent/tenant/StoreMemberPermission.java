package com.lth.ecommerceagent.tenant;

import jakarta.persistence.*;

@Entity
@Table(name="store_member_permissions", uniqueConstraints=@UniqueConstraint(columnNames={"store_member_id","permission"}))
public class StoreMemberPermission {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="store_member_id",nullable=false) private Long storeMemberId;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=40) private Permission permission;
    public StoreMemberPermission(){}
    public StoreMemberPermission(Long memberId, Permission permission){this.storeMemberId=memberId;this.permission=permission;}
    public Long getId(){return id;} public Long getStoreMemberId(){return storeMemberId;} public Permission getPermission(){return permission;}
}
