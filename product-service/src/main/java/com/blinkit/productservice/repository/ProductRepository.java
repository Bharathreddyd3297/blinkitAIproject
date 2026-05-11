package com.blinkit.productservice.repository;

import com.blinkit.productservice.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    Page<Product> findByCategoryIgnoreCase(String category, Pageable pageable);

    List<Product> findByCategoryIgnoreCase(String category);

    Optional<Product> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);

    // CAST(:param AS string) is required because Hibernate 6 binds a Java
    // `null` String with no type hint, and PostgreSQL then infers `bytea`,
    // which `lower(...)` does not accept ("function lower(bytea) does not
    // exist"). The cast forces text typing on the bind site so the IS NULL
    // short-circuit works whether the caller passes a value or null.
    @Query("SELECT p FROM Product p WHERE " +
            "(:category IS NULL OR LOWER(p.category) = LOWER(CAST(:category AS string))) AND " +
            "(:name IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:name AS string), '%')))")
    Page<Product> search(@Param("category") String category,
                         @Param("name") String name,
                         Pageable pageable);

}
