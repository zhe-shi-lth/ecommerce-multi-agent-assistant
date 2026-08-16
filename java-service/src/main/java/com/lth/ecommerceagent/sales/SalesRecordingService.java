package com.lth.ecommerceagent.sales;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.time.LocalDate;

import javax.sql.DataSource;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lth.ecommerceagent.order.Order;

@Service
public class SalesRecordingService {
    private final JdbcTemplate jdbc;
    private final DataSource dataSource;
    private volatile Boolean postgres;

    public SalesRecordingService(JdbcTemplate jdbc, DataSource dataSource) {
        this.jdbc = jdbc;
        this.dataSource = dataSource;
    }

    @Transactional
    public void recordShipment(Order order) {
        adjust(order, order.getQuantity(), order.getPayment(), 1);
    }

    @Transactional
    public void reverseRefund(Order order) {
        adjust(order, -order.getQuantity(), order.getPayment().negate(), -1);
    }

    @Transactional
    public void reverseAfterSale(Order order, int quantity, BigDecimal amount) {
        adjust(order, -quantity, amount.negate(), quantity >= order.getQuantity() ? -1 : 0);
    }

    private void adjust(Order order, int unitsDelta, BigDecimal revenueDelta, int countDelta) {
        LocalDate date = order.getShippedAt() != null
                ? order.getShippedAt().atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                : LocalDate.now();
        if (isPostgres()) {
            jdbc.update("""
                    INSERT INTO daily_sales(company_id,store_id,product_id,platform,sale_date,revenue,units,order_count)
                    VALUES (?,?,?,?,?,?,GREATEST(0,?),GREATEST(0,?))
                    ON CONFLICT (store_id,product_id,platform,sale_date) DO UPDATE SET
                      revenue=daily_sales.revenue+EXCLUDED.revenue,
                      units=GREATEST(0,daily_sales.units+?),
                      order_count=GREATEST(0,daily_sales.order_count+?)
                    """, order.getCompanyId(), order.getStoreId(), order.getProduct().getId(), order.getPlatform(), date, revenueDelta,
                    unitsDelta, countDelta, unitsDelta, countDelta);
            return;
        }

        int updated = jdbc.update("""
                UPDATE daily_sales SET
                  revenue=revenue+?,
                  units=CASE WHEN units+?<0 THEN 0 ELSE units+? END,
                  order_count=CASE WHEN order_count+?<0 THEN 0 ELSE order_count+? END
                WHERE company_id=? AND store_id=? AND product_id=? AND platform=? AND sale_date=?
                """, revenueDelta, unitsDelta, unitsDelta, countDelta, countDelta,
                order.getCompanyId(), order.getStoreId(), order.getProduct().getId(), order.getPlatform(), date);
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO daily_sales(company_id,store_id,product_id,platform,sale_date,revenue,units,order_count)
                    VALUES(?,?,?,?,?,?,?,?)
                    """, order.getCompanyId(), order.getStoreId(), order.getProduct().getId(), order.getPlatform(), date, revenueDelta,
                    Math.max(0, unitsDelta), Math.max(0, countDelta));
        }
    }

    private boolean isPostgres() {
        Boolean cached = postgres;
        if (cached != null) {
            return cached;
        }
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metadata = connection.getMetaData();
            postgres = metadata.getDatabaseProductName().toLowerCase().contains("postgresql");
            return postgres;
        } catch (SQLException exception) {
            throw new IllegalStateException("Unable to identify sales database", exception);
        }
    }
}
