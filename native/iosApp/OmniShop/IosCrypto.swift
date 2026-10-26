import CommonCrypto
import CryptoKit
import Foundation
import OmniShopShared
import Security

func makeCryptoCallbacks() -> IosCryptoCallbacks {
    IosCryptoCallbacks(
        random: { size in
            var bytes = [UInt8](repeating: 0, count: Int(size))
            let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
            precondition(status == errSecSuccess, "Secure random generation failed")
            return KotlinByteArray.from(Data(bytes))
        },
        derive: { password, salt, iterations in
            let passwordData = Data(password.utf8)
            let saltData = salt.toData()
            var derived = [UInt8](repeating: 0, count: 32)
            let status = passwordData.withUnsafeBytes { passwordBytes in
                saltData.withUnsafeBytes { saltBytes in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passwordBytes.bindMemory(to: Int8.self).baseAddress,
                        passwordData.count,
                        saltBytes.bindMemory(to: UInt8.self).baseAddress,
                        saltData.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(iterations),
                        &derived,
                        derived.count
                    )
                }
            }
            return status == kCCSuccess ? KotlinByteArray.from(Data(derived)) : nil
        },
        seal: { key, nonce, aad, plaintext in
            do {
                let sealed = try AES.GCM.seal(
                    plaintext.toData(),
                    using: SymmetricKey(data: key.toData()),
                    nonce: try AES.GCM.Nonce(data: nonce.toData()),
                    authenticating: aad.toData()
                )
                return KotlinByteArray.from(sealed.ciphertext + sealed.tag)
            } catch {
                return nil
            }
        },
        open: { key, nonce, aad, ciphertext in
            do {
                let combined = ciphertext.toData()
                guard combined.count > 16 else { return nil }
                let box = try AES.GCM.SealedBox(
                    nonce: try AES.GCM.Nonce(data: nonce.toData()),
                    ciphertext: Data(combined.prefix(combined.count - 16)),
                    tag: Data(combined.suffix(16))
                )
                let plaintext = try AES.GCM.open(
                    box,
                    using: SymmetricKey(data: key.toData()),
                    authenticating: aad.toData()
                )
                return KotlinByteArray.from(plaintext)
            } catch {
                return nil
            }
        }
    )
}
