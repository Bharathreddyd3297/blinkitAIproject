package com.blinkit.productservice.service;

import com.blinkit.productservice.dto.ProductRequest;
import com.blinkit.productservice.dto.ProductResponse;
import com.blinkit.productservice.entity.Product;
import org.springframework.stereotype.Component;

@Component
public class ProductMapper {

    public Product toEntity(ProductRequest request) {
        return Product.builder()
                .name(request.getName())
                .category(request.getCategory())
                .price(request.getPrice())
                .stock(request.getStock())
                .imageUrl(request.getImageUrl())
                .description(request.getDescription())
                .build();
    }

    public ProductResponse toResponse(Product product) {
        return ProductResponse.builder()
                .id(product.getId())
                .name(product.getName())
                .category(product.getCategory())
                .price(product.getPrice())
                .stock(product.getStock())
                .imageUrl(product.getImageUrl())
                .description(product.getDescription())
                .inStock(product.getStock() != null && product.getStock() > 0)
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }

    public void updateEntity(Product target, ProductRequest source) {
        target.setName(source.getName());
        target.setCategory(source.getCategory());
        target.setPrice(source.getPrice());
        target.setStock(source.getStock());
        target.setImageUrl(source.getImageUrl());
        target.setDescription(source.getDescription());
    }

}
