package com.omnishop.app

enum class AppLanguage { ENGLISH, THAI }

enum class Label {
    DISCOVER, SEARCH, SAVED, ORDERS, PROFILE, TITLE, PRODUCT_LINK, SAVE, EMPTY_SAVED,
    MERCHANT, QUANTITY, CREATE_ORDER, CANCEL, TRACKING_NUMBER, CARRIER, ATTACH_SHIPMENT,
    MANUAL_TRACKING, IN_TRANSIT, DELIVERED, EVENT_DESCRIPTION, NO_ORDERS, BACK,
    KEYWORDS, OPEN_SEARCH, EXTERNAL_ONLY, LINK_ONLY, METADATA_UNAVAILABLE, LOCAL_FIRST,
    LANGUAGE, MANUAL_EVENT, NATIVE_PREVIEW, NO_LIVE_API, NO_EVENTS, NO_SHIPMENTS,
    ITEM, DELIVERY_PROGRESS, MORE, FREE_TO_START,
    ADD_OFFER, PRICE_THB, SHIPPING_THB, UNKNOWN_SHIPPING, UNKNOWN_FEES, MANUAL_OFFER,
}

private val english = mapOf(
    Label.DISCOVER to "Discover", Label.SEARCH to "Search", Label.SAVED to "Saved",
    Label.ORDERS to "Orders", Label.PROFILE to "Profile", Label.TITLE to "Product title",
    Label.PRODUCT_LINK to "Product link (optional)", Label.SAVE to "Save", Label.EMPTY_SAVED to "Save your first product. Nothing is pre-added.",
    Label.MERCHANT to "Merchant / seller", Label.QUANTITY to "Quantity", Label.CREATE_ORDER to "Create purchase record",
    Label.CANCEL to "Cancel", Label.TRACKING_NUMBER to "Tracking number", Label.CARRIER to "Carrier label",
    Label.ATTACH_SHIPMENT to "Add package", Label.MANUAL_TRACKING to "Manual tracking — no carrier connection",
    Label.IN_TRANSIT to "In transit", Label.DELIVERED to "Delivered", Label.EVENT_DESCRIPTION to "Event description",
    Label.NO_ORDERS to "No orders yet. Create a purchase record from a saved product.", Label.BACK to "Back",
    Label.KEYWORDS to "Search keywords", Label.OPEN_SEARCH to "Open marketplace search",
    Label.EXTERNAL_ONLY to "External search only", Label.LINK_ONLY to "Link import only",
    Label.METADATA_UNAVAILABLE to "Bookmark only — metadata not fetched",
    Label.LOCAL_FIRST to "Stored on this device. No OmniShop account or server required.",
    Label.LANGUAGE to "Language", Label.MANUAL_EVENT to "Manual event", Label.NATIVE_PREVIEW to "Native foundation preview",
    Label.NO_LIVE_API to "Live marketplace APIs, carrier refresh, encrypted backup and device sync are not connected in this preview.",
    Label.NO_EVENTS to "No recorded events", Label.NO_SHIPMENTS to "No packages attached",
    Label.ITEM to "Item", Label.DELIVERY_PROGRESS to "Delivery progress", Label.MORE to "More",
    Label.FREE_TO_START to "Shop everywhere. Track locally.",
    Label.ADD_OFFER to "Add comparable offer", Label.PRICE_THB to "Item price (THB)",
    Label.SHIPPING_THB to "Shipping (THB, blank = unknown)", Label.UNKNOWN_SHIPPING to "Shipping unknown",
    Label.UNKNOWN_FEES to "Taxes / payment fees unknown; no delivered-price winner claimed",
    Label.MANUAL_OFFER to "Manually entered offer",
)

private val thai = mapOf(
    Label.DISCOVER to "ค้นพบ", Label.SEARCH to "ค้นหา", Label.SAVED to "บันทึกไว้",
    Label.ORDERS to "คำสั่งซื้อ", Label.PROFILE to "โปรไฟล์", Label.TITLE to "ชื่อสินค้า",
    Label.PRODUCT_LINK to "ลิงก์สินค้า (ไม่จำเป็น)", Label.SAVE to "บันทึก", Label.EMPTY_SAVED to "บันทึกสินค้าชิ้นแรกของคุณ ไม่มีสินค้าเพิ่มให้อัตโนมัติ",
    Label.MERCHANT to "ร้านค้า / ผู้ขาย", Label.QUANTITY to "จำนวน", Label.CREATE_ORDER to "สร้างบันทึกการซื้อ",
    Label.CANCEL to "ยกเลิก", Label.TRACKING_NUMBER to "หมายเลขติดตาม", Label.CARRIER to "ชื่อผู้ขนส่ง",
    Label.ATTACH_SHIPMENT to "เพิ่มพัสดุ", Label.MANUAL_TRACKING to "ติดตามด้วยตนเอง — ยังไม่เชื่อมต่อผู้ขนส่ง",
    Label.IN_TRANSIT to "อยู่ระหว่างขนส่ง", Label.DELIVERED to "จัดส่งแล้ว", Label.EVENT_DESCRIPTION to "รายละเอียดเหตุการณ์",
    Label.NO_ORDERS to "ยังไม่มีคำสั่งซื้อ สร้างบันทึกการซื้อจากสินค้าที่บันทึกไว้", Label.BACK to "กลับ",
    Label.KEYWORDS to "คำค้นหา", Label.OPEN_SEARCH to "เปิดการค้นหาในตลาดออนไลน์",
    Label.EXTERNAL_ONLY to "ค้นหาผ่านเว็บไซต์เท่านั้น", Label.LINK_ONLY to "นำเข้าลิงก์เท่านั้น",
    Label.METADATA_UNAVAILABLE to "บุ๊กมาร์กเท่านั้น — ยังไม่ได้ดึงข้อมูลสินค้า",
    Label.LOCAL_FIRST to "เก็บข้อมูลบนอุปกรณ์นี้ ไม่ต้องมีบัญชีหรือเซิร์ฟเวอร์ OmniShop",
    Label.LANGUAGE to "ภาษา", Label.MANUAL_EVENT to "เหตุการณ์ที่บันทึกเอง", Label.NATIVE_PREVIEW to "รุ่นทดสอบระบบเนทีฟพื้นฐาน",
    Label.NO_LIVE_API to "รุ่นทดสอบนี้ยังไม่เชื่อมต่อ API ตลาดออนไลน์ การอัปเดตจากผู้ขนส่ง การสำรองข้อมูลเข้ารหัส และการซิงก์อุปกรณ์",
    Label.NO_EVENTS to "ยังไม่มีเหตุการณ์ที่บันทึกไว้", Label.NO_SHIPMENTS to "ยังไม่มีพัสดุ",
    Label.ITEM to "สินค้า", Label.DELIVERY_PROGRESS to "ความคืบหน้าการจัดส่ง", Label.MORE to "เพิ่มเติม",
    Label.FREE_TO_START to "ช้อปได้ทุกที่ ติดตามบนอุปกรณ์ของคุณ",
    Label.ADD_OFFER to "เพิ่มข้อเสนอเพื่อเปรียบเทียบ", Label.PRICE_THB to "ราคาสินค้า (THB)",
    Label.SHIPPING_THB to "ค่าจัดส่ง (THB, เว้นว่างหากไม่ทราบ)", Label.UNKNOWN_SHIPPING to "ไม่ทราบค่าจัดส่ง",
    Label.UNKNOWN_FEES to "ยังไม่ทราบภาษี / ค่าธรรมเนียม จึงยังระบุราคาสุทธิที่ถูกที่สุดไม่ได้",
    Label.MANUAL_OFFER to "ข้อเสนอที่บันทึกเอง",
)

fun AppLanguage.text(label: Label): String = (if (this == AppLanguage.THAI) thai else english).getValue(label)

fun AppLanguage.progress(value: com.omnishop.core.DeliveryProgress): String = when (value) {
    com.omnishop.core.DeliveryProgress.NOT_SHIPPED -> if (this == AppLanguage.THAI) "ยังไม่จัดส่ง" else "Not shipped"
    com.omnishop.core.DeliveryProgress.IN_PROGRESS -> if (this == AppLanguage.THAI) "กำลังดำเนินการ" else "In progress"
    com.omnishop.core.DeliveryProgress.PARTIALLY_DELIVERED -> if (this == AppLanguage.THAI) "จัดส่งบางส่วนแล้ว" else "Partially delivered"
    com.omnishop.core.DeliveryProgress.DELIVERED -> text(Label.DELIVERED)
}
