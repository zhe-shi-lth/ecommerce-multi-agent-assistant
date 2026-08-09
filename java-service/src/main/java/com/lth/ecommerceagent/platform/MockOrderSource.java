package com.lth.ecommerceagent.platform;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Component;

/**
 * 模拟订单来源：本地造数，产出与真实平台同构的订单事实。
 *
 * <p>造出来的每一笔都带平台单号、收件人、金额、物流等真实订单会有的字段，
 * 目的是让整套系统在没有接平台的情况下也按"真的拉过单"的方式运转；
 * 接上平台后换成 {@link RealOrderSource}，下游一行都不用改。
 *
 * <p>注意：这里<b>不</b>判断库存是否够、也不决定订单状态——那是本系统的业务判断，
 * 与"订单从哪来"无关，统一放在 SimulationService 里做。
 */
@Component
public class MockOrderSource implements OrderSource {

    // 收件人/买家/物流 造数池（对齐平台订单 API 返回的结构化字段）
    private static final String[] PROVINCES = {"浙江省", "广东省", "江苏省", "北京市", "上海市", "四川省", "湖北省"};
    private static final String[] CITIES = {"杭州市", "深圳市", "南京市", "北京市", "上海市", "成都市", "武汉市"};
    private static final String[] DISTRICTS = {"西湖区", "南山区", "鼓楼区", "朝阳区", "浦东新区", "武侯区", "洪山区"};
    private static final String[] STREETS = {"文三路", "科技园路", "中山路", "建国路", "张江路", "天府大道", "光谷大道"};
    private static final String[] SURNAMES = {"王", "李", "张", "刘", "陈", "杨", "赵"};
    private static final String[] NICKS = {"小鹿", "栗子", "柚子", "桃子", "橙子", "麦麦", "糖糖"};
    private static final String[] LOGISTICS = {"顺丰速运", "中通快递", "圆通速递", "韵达快递", "京东物流"};
    private static final String[] POST_FEES = {"0.00", "6.00", "8.00", "12.00"};

    // 模拟单号自增序号（JVM 内唯一，配合毫秒时间戳避免重复）
    private static final AtomicLong SEQ = new AtomicLong();

    private final Random random = new Random();

    @Override
    public String name() {
        return "mock";
    }

    @Override
    public List<PulledOrder> pull(OrderPullCommand command) {
        List<PulledOrder> orders = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int d = command.days() - 1; d >= 0; d--) {
            LocalDate date = today.minusDays(d);
            for (PlanTarget target : command.targets()) {
                int n = 1 + random.nextInt(Math.max(1, command.maxOrdersPerDay()));
                for (int i = 0; i < n; i++) {
                    int qty = 1 + random.nextInt(Math.max(1, command.maxQty()));
                    orders.add(buildOne(target, qty, date));
                }
            }
        }
        return orders;
    }

    private PulledOrder buildOne(PlanTarget target, int qty, LocalDate date) {
        // 订单事实分布：约 70% 正常可发、15% 待分析（未付款/地址缺失）、15% 需人工复核。
        boolean paid;
        boolean addressComplete;
        boolean manualReview;
        double r = random.nextDouble();
        if (r < 0.70) {
            paid = true;
            addressComplete = true;
            manualReview = false;
        } else if (r < 0.85) {
            paid = false;
            addressComplete = random.nextBoolean();
            manualReview = false;
        } else {
            paid = random.nextBoolean();
            addressComplete = random.nextBoolean();
            manualReview = true;
        }

        String platform = target.platform();
        // 抖音密文电子面单 / 小红书加密收件人：平台对收件人信息加密
        boolean encrypted = "douyin".equals(platform) || "xiaohongshu".equals(platform);
        String name;
        String phone;
        String buyerNick;
        if (encrypted) {
            name = "收*人";
            phone = maskPhone();
            buyerNick = "匿名买家(平台加密)";
        } else {
            name = pick(SURNAMES) + (random.nextBoolean() ? "女士" : "先生");
            phone = "138" + (10000000 + random.nextInt(90000000));
            buyerNick = "tb_" + pick(NICKS) + (100 + random.nextInt(900));
        }
        // 地址不完整的订单就是缺字段——与平台返回缺字段的表现一致
        String province = addressComplete ? pick(PROVINCES) : null;
        String city = addressComplete ? pick(CITIES) : null;
        String district = addressComplete ? pick(DISTRICTS) : null;
        String detail = addressComplete ? pick(STREETS) + (1 + random.nextInt(200)) + "号" : null;

        // 金额：实付 = 售价 * 数量 + 邮费（对齐平台 payment / post_fee）
        BigDecimal sale = target.salePrice() != null ? target.salePrice() : BigDecimal.ZERO;
        BigDecimal post = new BigDecimal(pick(POST_FEES));

        // 物流：只有"付了款、地址全、无需复核"的订单才有运单，其余留空
        boolean shippable = paid && addressComplete && !manualReview;
        String logistics = shippable ? pick(LOGISTICS) : null;
        String waybill = shippable
                ? String.valueOf(10000000000000L + Math.abs(random.nextLong()) % 90000000000000L)
                : null;

        return new PulledOrder(
                platform,
                nextOrderId(),
                target.planId(),
                target.productId(),
                qty,
                paid,
                addressComplete,
                manualReview,
                date,
                addressComplete ? name : null,
                addressComplete ? phone : null,
                province,
                city,
                district,
                detail,
                buyerNick,
                sale.multiply(BigDecimal.valueOf(qty)).add(post),
                post,
                logistics,
                waybill,
                encrypted);
    }

    // 模拟单号：MOCK + 毫秒时间戳 + 自增序号，保证 (platform, platform_order_id) 唯一。
    private String nextOrderId() {
        return "MOCK" + System.currentTimeMillis() + String.format("%06d", SEQ.incrementAndGet());
    }

    private String pick(String[] arr) {
        return arr[random.nextInt(arr.length)];
    }

    // 隐私号：138****5678
    private String maskPhone() {
        int last = 1000 + random.nextInt(9000);
        return "1" + (3 + random.nextInt(6)) + "****" + last;
    }
}
