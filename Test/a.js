// Write a code for i want convert INR into USD, AED, japanice currency


const   convertCurrency = (amountInINR, targetCurrency) => {
    const exchangeRates = {
        USD: 0.013, // 1 INR = 0.013 USD
        AED: 0.048, // 1 INR = 0.048 AED
        JPY: 1.50   // 1 INR = 1.50 JPY
    };
    
    if (exchangeRates[targetCurrency]) {
        const convertedAmount = amountInINR * exchangeRates[targetCurrency];
        return `${amountInINR} INR is equal to ${convertedAmount.toFixed(2)} ${targetCurrency}`;
    }
    return 'Target currency not supported';
}
// Example usage:
const amountInINR = 1000;
const targetCurrency = 'USD'; // Change this to 'AED' or 'JPY' for other currencies 
const result = convertCurrency(amountInINR, targetCurrency);
console.log(result);
