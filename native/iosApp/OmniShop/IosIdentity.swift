import Foundation
import Security
import CryptoKit

struct IosIdentity {
    let identity: SecIdentity?
    let certificate: SecCertificate
    let deviceId: String
    let fingerprint: String
    let publicKeySPKI: Data

    static func loadOrCreate() throws -> IosIdentity {
        if let existing = try load() { return existing }
        return try generateAndStore()
    }

    private static let keyTag = Data("com.omnishop.sync.identity.key".utf8)
    private static let certLabel = "com.omnishop.sync.identity.cert"

    private static func load() throws -> IosIdentity? {
        guard let identity = loadIdentity() else { return nil }
        var certificateRef: SecCertificate?
        guard SecIdentityCopyCertificate(identity, &certificateRef) == errSecSuccess,
              let certificate = certificateRef else { return nil }
        return try make(identity: identity, certificate: certificate)
    }

    private static func loadIdentity() -> SecIdentity? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassIdentity,
            kSecReturnRef: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]
        var identityRef: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &identityRef) == errSecSuccess,
              let identity = identityRef as! SecIdentity? else { return nil }
        return identity
    }

    static func generateEphemeral() throws -> IosIdentity {
        let keyAttrs: [CFString: Any] = [
            kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits: 256,
        ]
        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(keyAttrs as CFDictionary, &error) else {
            throw cfError(error, code: 7)
        }
        guard let publicKey = SecKeyCopyPublicKey(privateKey),
              let publicRaw = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
            throw NSError(domain: "OmniShop", code: 8)
        }
        let spki = subjectPublicKeyInfo(publicRaw)
        let tbs = tbsCertificate(spki: spki, now: Date())
        guard let signature = SecKeyCreateSignature(
            privateKey, .ecdsaSignatureMessageX962SHA256, tbs as CFData, &error
        ) as Data? else {
            throw cfError(error, code: 9)
        }
        let sigAlg = sequence([oid([0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x04, 0x03, 0x02])])
        let der = sequence([tbs, sigAlg, bitString(signature)])
        guard let certificate = SecCertificateCreateWithData(nil, der as CFData) else {
            throw NSError(domain: "OmniShop", code: 10)
        }
        return try make(identity: nil, certificate: certificate)
    }

    private static func generateAndStore() throws -> IosIdentity {
        let keyAttrs: [CFString: Any] = [
            kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits: 256,
            kSecPrivateKeyAttrs: [
                kSecAttrIsPermanent: true,
                kSecAttrApplicationTag: keyTag,
                kSecAttrLabel: "OmniShop Sync Identity",
                kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
            ],
        ]
        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(keyAttrs as CFDictionary, &error) else {
            throw cfError(error, code: 1)
        }
        guard let publicKey = SecKeyCopyPublicKey(privateKey),
              let publicRaw = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
            throw NSError(domain: "OmniShop", code: 2)
        }
        let spki = subjectPublicKeyInfo(publicRaw)
        let now = Date()
        let tbs = tbsCertificate(spki: spki, now: now)
        guard let signature = SecKeyCreateSignature(
            privateKey,
            .ecdsaSignatureMessageX962SHA256,
            tbs as CFData,
            &error
        ) as Data? else {
            throw cfError(error, code: 3)
        }
        let sigAlg = sequence([oid([0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x04, 0x03, 0x02])])
        let certificateDER = sequence([tbs, sigAlg, bitString(signature)])
        guard let certificate = SecCertificateCreateWithData(nil, certificateDER as CFData) else {
            throw NSError(domain: "OmniShop", code: 4)
        }
        let add: [CFString: Any] = [
            kSecClass: kSecClassCertificate,
            kSecValueRef: certificate,
            kSecAttrLabel: certLabel,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemDelete([kSecClass: kSecClassCertificate, kSecAttrLabel: certLabel] as CFDictionary)
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else { throw NSError(domain: "OmniShop", code: Int(status)) }
        guard let identity = loadIdentity() else { throw NSError(domain: "OmniShop", code: 5) }
        return try make(identity: identity, certificate: certificate)
    }

    private static func cfError(_ error: Unmanaged<CFError>?, code: Int) -> Error {
        if let error { return error.takeRetainedValue() as Error }
        return NSError(domain: "OmniShop", code: code)
    }

    private static func make(identity: SecIdentity?, certificate: SecCertificate) throws -> IosIdentity {
        guard let publicKey = SecCertificateCopyKey(certificate),
              let raw = SecKeyCopyExternalRepresentation(publicKey, nil) as Data? else {
            throw NSError(domain: "OmniShop", code: 6)
        }
        let spki = subjectPublicKeyInfo(raw)
        let certDER = SecCertificateCopyData(certificate) as Data
        let deviceHash = Data(SHA256.hash(data: spki).prefix(16))
        let deviceId = deviceHash.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        let fingerprint = SHA256.hash(data: certDER).map { String(format: "%02x", $0) }.joined()
        return IosIdentity(identity: identity, certificate: certificate, deviceId: deviceId,
                           fingerprint: fingerprint, publicKeySPKI: spki)
    }

    private static func subjectPublicKeyInfo(_ raw: Data) -> Data {
        let algorithm = sequence([
            oid([0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01]),
            oid([0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07]),
        ])
        return sequence([algorithm, bitString(raw)])
    }

    private static func tbsCertificate(spki: Data, now: Date) -> Data {
        let version = explicit(0, integer(Data([2])))
        var serial = Data((0..<16).map { _ in UInt8.random(in: 0...255) })
        serial[0] &= 0x7F
        if serial[0] == 0 { serial[0] = 1 }
        let signatureAlgorithm = sequence([oid([0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x04, 0x03, 0x02])])
        let name = sequence([
            set([sequence([
                oid([0x55, 0x04, 0x03]),
                utf8("OmniShop Device"),
            ])]),
        ])
        let validity = sequence([
            utcTime(now.addingTimeInterval(-86_400)),
            utcTime(now.addingTimeInterval(10 * 365 * 24 * 60 * 60)),
        ])
        return sequence([version, integer(serial), signatureAlgorithm, name, validity, name, spki])
    }

    private static func sequence(_ items: [Data]) -> Data { tlv(0x30, items.reduce(Data(), +)) }
    private static func set(_ items: [Data]) -> Data { tlv(0x31, items.reduce(Data(), +)) }
    private static func explicit(_ tag: UInt8, _ content: Data) -> Data { tlv(0xA0 | tag, content) }
    private static func oid(_ bytes: [UInt8]) -> Data { tlv(0x06, Data(bytes)) }
    private static func utf8(_ value: String) -> Data { tlv(0x0C, Data(value.utf8)) }
    private static func bitString(_ value: Data) -> Data { tlv(0x03, Data([0]) + value) }
    private static func integer(_ value: Data) -> Data {
        var bytes = value
        while bytes.count > 1 && bytes.first == 0 { bytes.removeFirst() }
        if let first = bytes.first, first & 0x80 != 0 { bytes.insert(0, at: 0) }
        return tlv(0x02, bytes)
    }
    private static func utcTime(_ date: Date) -> Data {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyMMddHHmmss'Z'"
        return tlv(0x17, Data(formatter.string(from: date).utf8))
    }
    private static func tlv(_ tag: UInt8, _ content: Data) -> Data {
        Data([tag]) + derLength(content.count) + content
    }
    private static func derLength(_ length: Int) -> Data {
        if length < 0x80 { return Data([UInt8(length)]) }
        var value = length
        var bytes: [UInt8] = []
        while value > 0 { bytes.insert(UInt8(value & 0xFF), at: 0); value >>= 8 }
        return Data([0x80 | UInt8(bytes.count)] + bytes)
    }
}

func sas(secret: String, hostFingerprint: String, clientFingerprint: String) -> String {
    let key = SymmetricKey(data: Data(secret.utf8))
    let code = HMAC<SHA256>.authenticationCode(for: Data("\(hostFingerprint)|\(clientFingerprint)".utf8), using: key)
    let bytes = Array(code)
    let value = UInt32(bytes[0]) << 24 | UInt32(bytes[1]) << 16 | UInt32(bytes[2]) << 8 | UInt32(bytes[3])
    let number = String(format: "%06d", value % 1_000_000)
    return "\(number.prefix(3)) \(number.suffix(3))"
}
