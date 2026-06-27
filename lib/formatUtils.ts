
/**
 * Formats a number or string number with commas (e.g., 1000000 -> 1,000,000)
 * Returns empty string if input is empty or invalid
 */
export const formatNumberWithCommas = (value: string | number): string => {
    if (value === '' || value === undefined || value === null) return '';

    // Convert to string and remove existing commas to avoid double formatting
    const strValue = String(value).replace(/,/g, '');

    // Check if it's a valid number
    if (isNaN(Number(strValue))) return String(value);

    // Split into integer and decimal parts
    const parts = strValue.split('.');
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';

    // Add commas to integer part
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + decimalPart;
};

/**
 * Parses a formatted number string back to a clean string number (e.g., 1,000,000 -> 1000000)
 * Useful for raw value storage or calculations
 */
export const parseFormattedNumber = (value: string): string => {
    if (!value) return '';
    return value.replace(/,/g, '');
};

/**
 * Formats a number as a currency string with $ prefix
 */
export const formatCurrency = (value: string | number): string => {
    const formattedNumber = formatNumberWithCommas(value);
    return formattedNumber ? `$${formattedNumber}` : '';
};
