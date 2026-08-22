/**
 * Bakong KHQR & ABA Merchant PayWay Generator
 * Official Merchant Profile: CHHIV SERHOUT
 */

// Official Master ABA Merchant KHQR String from ABA Merchant App
const OFFICIAL_MERCHANT_KHQR = '00020101021130510016abaakhppxxx@abaa01151250717144518240208ABA Bank5204490053031165802KH5913CHHIV SERHOUT6010PHNOM PENH624268380010PAYWAY@ABA01071405768020903188685063041F51';

// CRC16-CCITT Calculation
function calculateCRC16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generate standard Bakong KHQR String
 * Always returns the user's authentic ABA Merchant KHQR string
 */
function generateKHQR() {
  return OFFICIAL_MERCHANT_KHQR;
}

/**
 * Generate Mobile Deep Links for direct checkout in Banking Apps
 * @param {string} khqrString
 */
function generateDeepLinks(khqrString = OFFICIAL_MERCHANT_KHQR) {
  const encodedKHQR = encodeURIComponent(khqrString);

  const bakongUniversalLink = `https://link.bakong.org.kh/pay?khqr=${encodedKHQR}`;
  const abaMobileScheme = `abamobilebank://khqr?qr=${encodedKHQR}`;
  const bakongAppScheme = `bakong://pay?khqr=${encodedKHQR}`;

  return {
    bakongUniversalLink,
    abaMobileScheme,
    bakongAppScheme,
    directKhqrData: khqrString
  };
}

module.exports = {
  generateKHQR,
  generateDeepLinks,
  calculateCRC16,
  OFFICIAL_MERCHANT_KHQR
};
