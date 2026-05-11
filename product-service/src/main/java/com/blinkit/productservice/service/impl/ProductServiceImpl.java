package com.blinkit.productservice.service.impl;

import com.blinkit.productservice.cache.ProductCache;
import com.blinkit.productservice.dto.InventoryUpdateRequest;
import com.blinkit.productservice.dto.PageResponse;
import com.blinkit.productservice.dto.ProductRequest;
import com.blinkit.productservice.dto.ProductResponse;
import com.blinkit.productservice.entity.Product;
import com.blinkit.productservice.exception.InsufficientStockException;
import com.blinkit.productservice.exception.ResourceAlreadyExistsException;
import com.blinkit.productservice.exception.ResourceNotFoundException;
import com.blinkit.productservice.repository.ProductRepository;
import com.blinkit.productservice.service.ProductMapper;
import com.blinkit.productservice.service.ProductService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final ProductMapper productMapper;
    private final ProductCache productCache;

    @Override
    public ProductResponse createProduct(ProductRequest request) {
        if (productRepository.existsByNameIgnoreCase(request.getName())) {
            throw new ResourceAlreadyExistsException(
                    String.format("Product with name '%s' already exists", request.getName()));
        }

        Product product = productMapper.toEntity(request);
        Product saved = productRepository.save(product);
        log.info("Product created: id={}, name={}", saved.getId(), saved.getName());
        productCache.invalidateAllProductCaches(saved.getId(), "product-created");
        return productMapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponse getProductById(Long id) {
        return productCache.getOrLoad(
                ProductCache.Keys.byId(id),
                () -> productMapper.toResponse(findProductOrThrow(id))
        );
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> getAllProducts(Pageable pageable) {
        String key = pageKey(ProductCache.Keys.ALL_PREFIX, pageable);
        return productCache.getOrLoad(key, () -> {
            Page<Product> page = productRepository.findAll(pageable);
            return PageResponse.from(page, productMapper::toResponse);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> getProductsByCategory(String category, Pageable pageable) {
        String key = pageKey(ProductCache.Keys.CATEGORY_PREFIX + category.toLowerCase(), pageable);
        return productCache.getOrLoad(key, () -> {
            Page<Product> page = productRepository.findByCategoryIgnoreCase(category, pageable);
            return PageResponse.from(page, productMapper::toResponse);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> searchProducts(String category, String name, Pageable pageable) {
        String normalizedCategory = StringUtils.hasText(category) ? category : null;
        String normalizedName = StringUtils.hasText(name) ? name : null;
        String key = ProductCache.Keys.SEARCH_PREFIX
                + "cat=" + (normalizedCategory == null ? "" : normalizedCategory.toLowerCase())
                + ":name=" + (normalizedName == null ? "" : normalizedName.toLowerCase())
                + pageSuffix(pageable);
        return productCache.getOrLoad(key, () -> {
            Page<Product> page = productRepository.search(normalizedCategory, normalizedName, pageable);
            return PageResponse.from(page, productMapper::toResponse);
        });
    }

    @Override
    public ProductResponse updateProduct(Long id, ProductRequest request) {
        Product existing = findProductOrThrow(id);

        if (!existing.getName().equalsIgnoreCase(request.getName())
                && productRepository.existsByNameIgnoreCase(request.getName())) {
            throw new ResourceAlreadyExistsException(
                    String.format("Product with name '%s' already exists", request.getName()));
        }

        productMapper.updateEntity(existing, request);
        Product saved = productRepository.save(existing);
        log.info("Product updated: id={}", saved.getId());
        productCache.invalidateAllProductCaches(saved.getId(), "product-updated");
        return productMapper.toResponse(saved);
    }

    @Override
    public void deleteProduct(Long id) {
        Product product = findProductOrThrow(id);
        productRepository.delete(product);
        log.info("Product deleted: id={}", id);
        productCache.invalidateAllProductCaches(id, "product-deleted");
    }

    @Override
    public ProductResponse adjustInventory(Long id, InventoryUpdateRequest request) {
        Product product = findProductOrThrow(id);

        int newStock = product.getStock() + request.getDelta();
        if (newStock < 0) {
            throw new InsufficientStockException(
                    String.format("Insufficient stock for product '%s'. Current=%d, requested delta=%d",
                            product.getName(), product.getStock(), request.getDelta()));
        }

        product.setStock(newStock);
        Product saved = productRepository.save(product);
        log.info("Inventory adjusted: id={}, delta={}, newStock={}, reason={}",
                id, request.getDelta(), newStock, request.getReason());
        productCache.invalidateAllProductCaches(saved.getId(), "inventory-adjusted");
        return productMapper.toResponse(saved);
    }

    private Product findProductOrThrow(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }

    private String pageKey(String prefix, Pageable pageable) {
        return prefix + pageSuffix(pageable);
    }

    private String pageSuffix(Pageable pageable) {
        return ":p" + pageable.getPageNumber()
                + ":s" + pageable.getPageSize()
                + ":sort" + pageable.getSort().toString().replace(' ', '_');
    }

}
