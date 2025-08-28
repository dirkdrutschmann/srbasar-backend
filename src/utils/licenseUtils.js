/**
 * Bestimmt die benötigte SR-Lizenz basierend auf dem Liga-Namen
 * @param {Object} data - Spieldaten mit liganame
 * @returns {string} - Benötigte Lizenz (LSE, LSE+, LSD oder Kombinationen)
 */
const fieldFn = (data) => {
  const liganame = data.liganame || data.ligaName || '';
  
  if (liganame.includes("Herren")) {
    if (liganame.includes("Kreisliga")) {
      return "LSE";
    }
    return "LSD";
  }
  
  if (liganame.includes("Damen")) {
    if (liganame.includes("Bezirksliga")) {
      return "LSE";
    }
    if (liganame.includes("Landesliga")) {
      return "LSE";
    }
    return "LSD";
  }
  
  if (liganame.includes("Oberliga")) {
    return "LSE+,LSD";
  }
  
  if (liganame.includes("Playoffs")) {
    return "LSE+,LSD";
  }
  
  return "LSE";
};

module.exports = {
  fieldFn
};
