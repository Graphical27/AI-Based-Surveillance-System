// utils/hexToBase64.js
export function hexToBase64(hex) {
  const bytes = hex.match(/[\da-f]{2}/gi).map(h => String.fromCharCode(parseInt(h, 16)))
  return btoa(bytes.join(''))
}
