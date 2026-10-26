import Foundation
import OmniShopShared
import Security

private let service = "OmniShopNative"

private func keychainQuery(_ key: String) -> [String: Any] {
    [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: key,
    ]
}

func makeSecretCallbacks() -> IosSecretCallbacks {
    IosSecretCallbacks(
        get: { key in
            var query = keychainQuery(key)
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            var result: CFTypeRef?
            guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
                  let data = result as? Data else { return nil }
            return KotlinByteArray.from(data)
        },
        set: { key, value in
            let query = keychainQuery(key)
            SecItemDelete(query as CFDictionary)
            var attributes = query
            attributes[kSecValueData as String] = value.toData()
            attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            _ = SecItemAdd(attributes as CFDictionary, nil)
        },
        delete: { key in
            _ = SecItemDelete(keychainQuery(key) as CFDictionary)
        }
    )
}
