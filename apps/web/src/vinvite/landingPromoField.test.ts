import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The promo field used to carry a placeholder, "e.g. EMIR" — and EMIR is a real
 * code. A sample that works is a discount handed to every visitor.
 */
describe('the order form\'s promo field', () => {
  const page = readFileSync(join(__dirname, 'LandingPage.tsx'), 'utf8');
  const i18n = readFileSync(join(__dirname, 'i18n.ts'), 'utf8');

  it('shows no sample code', () => {
    const field = page.slice(page.indexOf('className="vi-order-promo"'), page.indexOf('vi-order-hint'));
    expect(field).not.toMatch(/placeholder=/);
    expect(i18n).not.toMatch(/ord_promo_ph/);
  });
});
