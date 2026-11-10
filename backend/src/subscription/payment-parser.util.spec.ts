import { parsePaymentDetail } from './payment-parser.util';

describe('PaymentParserUtil', () => {
  it('should return null when input is null or undefined or invalid', () => {
    expect(parsePaymentDetail(null)).toBeNull();
    expect(parsePaymentDetail(undefined)).toBeNull();
    expect(parsePaymentDetail('string-payload')).toBeNull();
    expect(parsePaymentDetail(12345)).toBeNull();
    expect(parsePaymentDetail({})).toBeNull();
  });

  it('should parse QR_CODE payment detail correctly', () => {
    const payload = {
      type: 'QR_CODE',
      qr_code: {
        channel_properties: {
          qr_string:
            '00020101021226670016ID.CO.MAYAR.WWW0118936009110021609101',
        },
      },
    };

    const parsed = parsePaymentDetail(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('QR_CODE');
    expect(parsed?.qrString).toBe(
      '00020101021226670016ID.CO.MAYAR.WWW0118936009110021609101',
    );
  });

  it('should parse VIRTUAL_ACCOUNT payment detail correctly', () => {
    const payload = {
      type: 'VIRTUAL_ACCOUNT',
      virtual_account: {
        channel_code: 'bca',
        channel_properties: {
          virtual_account_number: '12345678901234',
          customer_name: 'KEENAN LAUNDRY',
        },
      },
    };

    const parsed = parsePaymentDetail(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('VIRTUAL_ACCOUNT');
    expect(parsed?.vaNumber).toBe('12345678901234');
    expect(parsed?.vaBank).toBe('BCA');
    expect(parsed?.customerName).toBe('KEENAN LAUNDRY');
  });

  it('should sanitize EWALLET actions and filter unsafe schemes (XSS prevention)', () => {
    const payload = {
      type: 'EWALLET',
      ewallet: {
        channel_code: 'gopay',
        actions: [
          { url: 'https://gopay.co.id/pay/123', url_type: 'WEB' },
          { url: 'gojek://pay/123', url_type: 'DEEPLINK' },
          { url: 'javascript:alert(1)', url_type: 'XSS' },
        ],
      },
    };

    const parsed = parsePaymentDetail(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('EWALLET');
    expect(parsed?.actions).toHaveLength(2);
    expect(parsed?.actions?.[0].url).toBe('https://gopay.co.id/pay/123');
    expect(parsed?.actions?.[1].url).toBe('gojek://pay/123');
  });

  it('should never throw when encountering deeply broken objects', () => {
    const broken = {
      type: 'QR_CODE',
      qr_code: 'not-an-object',
    };
    expect(() => parsePaymentDetail(broken)).not.toThrow();
    expect(parsePaymentDetail(broken)).toBeNull();
  });
});
