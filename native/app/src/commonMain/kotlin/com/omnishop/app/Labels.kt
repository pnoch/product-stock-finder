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
    BACKUP, BACKUP_NOTE, EXPORT_BACKUP, RESTORE_BACKUP, BACKUP_PASSWORD, BACKUP_PASSWORD_HINT,
    BACKUP_EXPORTED, BACKUP_RESTORED, BACKUP_REPLACE_WARNING, BACKUP_CANCELLED, BACKUP_FAILED, RESTORE,
    SHIPPING_ADDRESS, ADDRESS, ADDRESS_HINT, SAVE_ADDRESS, ADDRESS_UNAVAILABLE,
    ITEM_TITLE, ADD_ITEM, REMAINING, ALL_ALLOCATED,
    RETURNS, MANAGE_RETURNS, RETURN_MANUAL_NOTICE, RECORD_RETURN, RETURN_REASON, RETURN_QUANTITY,
    NO_RETURNS, NO_RETURNABLE_UNITS, UPDATE_RETURN, REFUND_AMOUNT, RECORDED_REFUND,
    RETURN_TRACKING, RETURN_NOTES,
    CARRIER_CONNECTION, THAILAND_POST_API_KEY, API_KEY_HINT, API_KEY_SAVED, API_KEY_CLEARED,
    API_KEY_CLEAR, CONFIGURED, NOT_CONFIGURED, REFRESH_TRACKING, CARRIER_NOT_CONFIGURED,
    TRACKING_UPDATED, CARRIER_EVENT, CARRIER_MODE, MANUAL_CARRIER, CARRIER_TRACKING, PACKAGE_DETAILS,
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
    Label.NO_LIVE_API to "Live marketplace APIs, carrier refresh and device sync are not connected in this preview.",
    Label.NO_EVENTS to "No recorded events", Label.NO_SHIPMENTS to "No packages attached",
    Label.ITEM to "Item", Label.DELIVERY_PROGRESS to "Delivery progress", Label.MORE to "More",
    Label.FREE_TO_START to "Shop everywhere. Track locally.",
    Label.ADD_OFFER to "Add comparable offer", Label.PRICE_THB to "Item price (THB)",
    Label.SHIPPING_THB to "Shipping (THB, blank = unknown)", Label.UNKNOWN_SHIPPING to "Shipping unknown",
    Label.UNKNOWN_FEES to "Taxes / payment fees unknown; no delivered-price winner claimed",
    Label.MANUAL_OFFER to "Manually entered offer",
    Label.BACKUP to "Encrypted backup", Label.BACKUP_NOTE to "Exports products, offers, orders, returns/refunds and tracking timeline. AES-256-GCM with a password-derived key.",
    Label.EXPORT_BACKUP to "Export backup", Label.RESTORE_BACKUP to "Restore backup",
    Label.BACKUP_PASSWORD to "Backup password", Label.BACKUP_PASSWORD_HINT to "At least 8 characters. The password is not stored; losing it makes the backup unreadable.",
    Label.BACKUP_EXPORTED to "Encrypted backup saved.", Label.BACKUP_RESTORED to "Backup restored.",
    Label.BACKUP_REPLACE_WARNING to "Restoring replaces all local products, offers, orders, addresses, returns/refunds and tracking events on this device.",
    Label.BACKUP_CANCELLED to "Backup cancelled.", Label.BACKUP_FAILED to "Backup failed:", Label.RESTORE to "Restore",
    Label.SHIPPING_ADDRESS to "Shipping address", Label.ADDRESS to "Address", Label.ADDRESS_HINT to "Encrypted at rest with the device key. Included in encrypted backups only.",
    Label.SAVE_ADDRESS to "Save address", Label.ADDRESS_UNAVAILABLE to "Address encryption is unavailable on this device.",
    Label.ITEM_TITLE to "Item title", Label.ADD_ITEM to "Add item", Label.REMAINING to "remaining",
    Label.ALL_ALLOCATED to "All ordered units are allocated to packages.",
    Label.RETURNS to "Returns & refunds", Label.MANAGE_RETURNS to "Manage returns & refunds",
    Label.RETURN_MANUAL_NOTICE to "Local records only. Recording a return does not contact the seller or move money.",
    Label.RECORD_RETURN to "Record return request", Label.RETURN_REASON to "Return reason",
    Label.RETURN_QUANTITY to "Return quantity", Label.NO_RETURNS to "No returns recorded for this order.",
    Label.NO_RETURNABLE_UNITS to "All units already have an active return record.",
    Label.UPDATE_RETURN to "Update return", Label.REFUND_AMOUNT to "Refund amount",
    Label.RECORDED_REFUND to "Recorded refund", Label.RETURN_TRACKING to "Return tracking number (optional)",
    Label.RETURN_NOTES to "Return / refund notes (optional)",
    Label.CARRIER_CONNECTION to "Carrier connections", Label.THAILAND_POST_API_KEY to "Thailand Post API key",
    Label.API_KEY_HINT to "Stored only in the device's secure store. Requests go directly to Thailand Post; no OmniShop server is involved.",
    Label.API_KEY_SAVED to "API key saved.", Label.API_KEY_CLEARED to "API key removed.",
    Label.API_KEY_CLEAR to "Remove key", Label.CONFIGURED to "Configured", Label.NOT_CONFIGURED to "Not configured",
    Label.REFRESH_TRACKING to "Refresh tracking", Label.CARRIER_NOT_CONFIGURED to "Add a Thailand Post API key in Profile first.",
    Label.TRACKING_UPDATED to "Tracking refreshed.", Label.CARRIER_EVENT to "carrier event",
    Label.CARRIER_MODE to "Carrier connection", Label.MANUAL_CARRIER to "Manual",
    Label.CARRIER_TRACKING to "Carrier tracking — refresh for updates", Label.PACKAGE_DETAILS to "Package details",
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
    Label.NO_LIVE_API to "รุ่นทดสอบนี้ยังไม่เชื่อมต่อ API ตลาดออนไลน์ การอัปเดตจากผู้ขนส่ง และการซิงก์อุปกรณ์",
    Label.NO_EVENTS to "ยังไม่มีเหตุการณ์ที่บันทึกไว้", Label.NO_SHIPMENTS to "ยังไม่มีพัสดุ",
    Label.ITEM to "สินค้า", Label.DELIVERY_PROGRESS to "ความคืบหน้าการจัดส่ง", Label.MORE to "เพิ่มเติม",
    Label.FREE_TO_START to "ช้อปได้ทุกที่ ติดตามบนอุปกรณ์ของคุณ",
    Label.ADD_OFFER to "เพิ่มข้อเสนอเพื่อเปรียบเทียบ", Label.PRICE_THB to "ราคาสินค้า (THB)",
    Label.SHIPPING_THB to "ค่าจัดส่ง (THB, เว้นว่างหากไม่ทราบ)", Label.UNKNOWN_SHIPPING to "ไม่ทราบค่าจัดส่ง",
    Label.UNKNOWN_FEES to "ยังไม่ทราบภาษี / ค่าธรรมเนียม จึงยังระบุราคาสุทธิที่ถูกที่สุดไม่ได้",
    Label.MANUAL_OFFER to "ข้อเสนอที่บันทึกเอง",
    Label.BACKUP to "สำรองข้อมูลเข้ารหัส", Label.BACKUP_NOTE to "ส่งออกสินค้า ข้อเสนอ คำสั่งซื้อ การคืนสินค้า/เงิน และไทม์ไลน์การติดตาม ด้วย AES-256-GCM และรหัสผ่าน",
    Label.EXPORT_BACKUP to "ส่งออกข้อมูลสำรอง", Label.RESTORE_BACKUP to "กู้คืนข้อมูลสำรอง",
    Label.BACKUP_PASSWORD to "รหัสผ่านสำหรับข้อมูลสำรอง", Label.BACKUP_PASSWORD_HINT to "อย่างน้อย 8 ตัวอักษร ระบบจะไม่เก็บรหัสผ่าน หากลืมจะเปิดข้อมูลสำรองไม่ได้",
    Label.BACKUP_EXPORTED to "บันทึกข้อมูลสำรองเข้ารหัสแล้ว", Label.BACKUP_RESTORED to "กู้คืนข้อมูลสำรองแล้ว",
    Label.BACKUP_REPLACE_WARNING to "การกู้คืนจะแทนที่สินค้า ข้อเสนอ คำสั่งซื้อ ที่อยู่ การคืนสินค้า/เงิน และเหตุการณ์ติดตามทั้งหมดบนอุปกรณ์นี้",
    Label.BACKUP_CANCELLED to "ยกเลิกการสำรองข้อมูล", Label.BACKUP_FAILED to "สำรองข้อมูลไม่สำเร็จ:", Label.RESTORE to "กู้คืน",
    Label.SHIPPING_ADDRESS to "ที่อยู่จัดส่ง", Label.ADDRESS to "ที่อยู่", Label.ADDRESS_HINT to "เข้ารหัสไว้บนอุปกรณ์ด้วยคีย์ของอุปกรณ์ และรวมอยู่ในข้อมูลสำรองที่เข้ารหัสเท่านั้น",
    Label.SAVE_ADDRESS to "บันทึกที่อยู่", Label.ADDRESS_UNAVAILABLE to "อุปกรณ์นี้ไม่สามารถเข้ารหัสที่อยู่ได้",
    Label.ITEM_TITLE to "ชื่อสินค้า", Label.ADD_ITEM to "เพิ่มสินค้า", Label.REMAINING to "คงเหลือ",
    Label.ALL_ALLOCATED to "สินค้าทั้งหมดถูกจัดสรรให้พัสดุแล้ว",
    Label.RETURNS to "การคืนสินค้าและคืนเงิน", Label.MANAGE_RETURNS to "จัดการการคืนสินค้าและคืนเงิน",
    Label.RETURN_MANUAL_NOTICE to "เป็นบันทึกในอุปกรณ์เท่านั้น การบันทึกไม่ใช่การติดต่อผู้ขายหรือโอนเงิน",
    Label.RECORD_RETURN to "บันทึกคำขอคืนสินค้า", Label.RETURN_REASON to "เหตุผลการคืนสินค้า",
    Label.RETURN_QUANTITY to "จำนวนที่คืน", Label.NO_RETURNS to "ยังไม่มีบันทึกการคืนสินค้าสำหรับคำสั่งซื้อนี้",
    Label.NO_RETURNABLE_UNITS to "สินค้าทุกชิ้นมีบันทึกการคืนที่กำลังดำเนินการแล้ว",
    Label.UPDATE_RETURN to "อัปเดตการคืนสินค้า", Label.REFUND_AMOUNT to "จำนวนเงินคืน",
    Label.RECORDED_REFUND to "เงินคืนที่บันทึกไว้", Label.RETURN_TRACKING to "หมายเลขติดตามพัสดุคืน (ไม่จำเป็น)",
    Label.RETURN_NOTES to "หมายเหตุการคืนสินค้า / เงิน (ไม่จำเป็น)",
    Label.CARRIER_CONNECTION to "การเชื่อมต่อผู้ขนส่ง", Label.THAILAND_POST_API_KEY to "คีย์ API ไปรษณีย์ไทย",
    Label.API_KEY_HINT to "เก็บไว้ในระบบจัดเก็บความปลอดภัยของอุปกรณ์เท่านั้น คำขอจะส่งตรงไปยังไปรษณีย์ไทย ไม่ผ่านเซิร์ฟเวอร์ OmniShop",
    Label.API_KEY_SAVED to "บันทึกคีย์ API แล้ว", Label.API_KEY_CLEARED to "ลบคีย์ API แล้ว",
    Label.API_KEY_CLEAR to "ลบคีย์", Label.CONFIGURED to "ตั้งค่าแล้ว", Label.NOT_CONFIGURED to "ยังไม่ได้ตั้งค่า",
    Label.REFRESH_TRACKING to "อัปเดตการติดตาม", Label.CARRIER_NOT_CONFIGURED to "กรุณาเพิ่มคีย์ API ไปรษณีย์ไทยในโปรไฟล์ก่อน",
    Label.TRACKING_UPDATED to "อัปเดตการติดตามแล้ว", Label.CARRIER_EVENT to "เหตุการณ์จากผู้ขนส่ง",
    Label.CARRIER_MODE to "การเชื่อมต่อผู้ขนส่ง", Label.MANUAL_CARRIER to "ด้วยตนเอง",
    Label.CARRIER_TRACKING to "ติดตามผ่านผู้ขนส่ง — กดอัปเดตเพื่อรับข้อมูลล่าสุด", Label.PACKAGE_DETAILS to "รายละเอียดพัสดุ",
)

fun AppLanguage.text(label: Label): String = (if (this == AppLanguage.THAI) thai else english).getValue(label)

fun AppLanguage.progress(value: com.omnishop.core.DeliveryProgress): String = when (value) {
    com.omnishop.core.DeliveryProgress.NOT_SHIPPED -> if (this == AppLanguage.THAI) "ยังไม่จัดส่ง" else "Not shipped"
    com.omnishop.core.DeliveryProgress.IN_PROGRESS -> if (this == AppLanguage.THAI) "กำลังดำเนินการ" else "In progress"
    com.omnishop.core.DeliveryProgress.PARTIALLY_DELIVERED -> if (this == AppLanguage.THAI) "จัดส่งบางส่วนแล้ว" else "Partially delivered"
    com.omnishop.core.DeliveryProgress.DELIVERED -> text(Label.DELIVERED)
}

fun AppLanguage.returnStatus(value: com.omnishop.core.ReturnStatus): String {
    val thai = this == AppLanguage.THAI
    return when (value) {
        com.omnishop.core.ReturnStatus.REQUESTED -> if (thai) "ขอคืนสินค้าแล้ว" else "Requested"
        com.omnishop.core.ReturnStatus.APPROVED -> if (thai) "อนุมัติแล้ว" else "Approved"
        com.omnishop.core.ReturnStatus.ITEM_RETURNED -> if (thai) "ส่งสินค้าคืนแล้ว" else "Item returned"
        com.omnishop.core.ReturnStatus.PROCESSING -> if (thai) "กำลังดำเนินการ" else "Processing"
        com.omnishop.core.ReturnStatus.PARTIALLY_REFUNDED -> if (thai) "คืนเงินบางส่วนแล้ว" else "Partially refunded"
        com.omnishop.core.ReturnStatus.REFUNDED -> if (thai) "คืนเงินแล้ว" else "Refunded"
        com.omnishop.core.ReturnStatus.REJECTED -> if (thai) "ปฏิเสธแล้ว" else "Rejected"
        com.omnishop.core.ReturnStatus.DISPUTED -> if (thai) "มีข้อพิพาท" else "Disputed"
    }
}
