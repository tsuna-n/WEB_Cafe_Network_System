declare module 'promptpay-qr' {
    function generatePayload(id: string, options: { amount: number }): string;
    export = generatePayload;
}
