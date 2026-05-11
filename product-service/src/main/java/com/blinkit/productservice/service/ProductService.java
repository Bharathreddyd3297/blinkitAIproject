package com.blinkit.productservice.service;

import com.blinkit.productservice.dto.InventoryUpdateRequest;
import com.blinkit.productservice.dto.PageResponse;
import com.blinkit.productservice.dto.ProductRequest;
import com.blinkit.productservice.dto.ProductResponse;
import org.springframework.data.domain.Pageable;

public interface ProductService {

    ProductResponse createProduct(ProductRequest request);

    ProductResponse getProductById(Long id);

    PageResponse<ProductResponse> getAllProducts(Pageable pageable);

    PageResponse<ProductResponse> getProductsByCategory(String category, Pageable pageable);

    PageResponse<ProductResponse> searchProducts(String category, String name, Pageable pageable);

    ProductResponse updateProduct(Long id, ProductRequest request);

    void deleteProduct(Long id);

    ProductResponse adjustInventory(Long id, InventoryUpdateRequest request);

}
