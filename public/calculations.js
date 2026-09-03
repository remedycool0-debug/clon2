export function depositTotal(principal, annualPercent, days, withholdingPercent = 17.5) {
  if (![principal, annualPercent, days, withholdingPercent].every(Number.isFinite) || principal < 0 || annualPercent < 0 || days < 1 || days > 730 || withholdingPercent < 0 || withholdingPercent > 100) return null;
  return principal + principal * annualPercent / 100 * days / 365 * (1 - withholdingPercent / 100);
}
export function monthlyPayment(principal, monthlyPercent, months) {
  if (![principal, monthlyPercent, months].every(Number.isFinite) || principal < 0 || monthlyPercent < 0 || months < 1 || months > 360) return null;
  const rate = monthlyPercent / 100;
  return rate === 0 ? principal / months : principal * rate / (1 - (1 + rate) ** -months);
}
