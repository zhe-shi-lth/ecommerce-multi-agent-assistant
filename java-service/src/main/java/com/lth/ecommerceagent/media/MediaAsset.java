package com.lth.ecommerceagent.media;
import java.time.Instant;
import com.lth.ecommerceagent.operation.OperationPlan;
import com.lth.ecommerceagent.product.Product;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
@Entity @Table(name="media_assets")
public class MediaAsset {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="product_id") private Product product;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="operation_plan_id") private OperationPlan operationPlan;
 @Column(name="asset_type",nullable=false,length=20) private String assetType;
 @Column(name="source_url",nullable=false,columnDefinition="text") private String sourceUrl;
 @Column(name="storage_url",nullable=false,columnDefinition="text") private String storageUrl;
 @Column(name="content_type",length=100) private String contentType;
 @Column(name="byte_size") private Long byteSize;
 @Column(length=64) private String sha256;
 @CreationTimestamp @Column(name="created_at",updatable=false) private Instant createdAt;
 public Long getId(){return id;} public Product getProduct(){return product;} public void setProduct(Product v){product=v;} public OperationPlan getOperationPlan(){return operationPlan;} public void setOperationPlan(OperationPlan v){operationPlan=v;} public String getAssetType(){return assetType;} public void setAssetType(String v){assetType=v;} public String getSourceUrl(){return sourceUrl;} public void setSourceUrl(String v){sourceUrl=v;} public String getStorageUrl(){return storageUrl;} public void setStorageUrl(String v){storageUrl=v;} public Instant getCreatedAt(){return createdAt;}
}
