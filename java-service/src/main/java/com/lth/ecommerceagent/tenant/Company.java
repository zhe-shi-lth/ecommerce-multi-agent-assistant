package com.lth.ecommerceagent.tenant;

import java.time.Instant;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "companies")
public class Company {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 120) private String name;
    @Column(nullable = false, length = 20) private String status = "ACTIVE";
    @CreationTimestamp @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
    @UpdateTimestamp @Column(name="updated_at", nullable=false) private Instant updatedAt;
    public Long getId(){return id;} public String getName(){return name;} public void setName(String v){name=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;}
    public Instant getCreatedAt(){return createdAt;} public Instant getUpdatedAt(){return updatedAt;}
}
