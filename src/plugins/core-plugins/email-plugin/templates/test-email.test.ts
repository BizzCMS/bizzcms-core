import { describe, it, expect } from 'vitest'
import { renderTestEmail } from './test-email'

describe('renderTestEmail', () => {
  it('produces a confirmation-style subject + body identifying the site', () => {
    const out = renderTestEmail({ siteName: 'BizzCMS' })

    expect(out.subject).toBe('BizzCMS email test')
    expect(out.html).toContain('BizzCMS')
    expect(out.html).toMatch(/test email/i)
    expect(out.text).toContain('BizzCMS')
    expect(out.text).toMatch(/test email/i)
  })

  it('HTML-escapes the siteName', () => {
    const out = renderTestEmail({ siteName: '<b>BizzCMS</b>' })

    expect(out.html).not.toContain('<b>BizzCMS</b>')
    expect(out.html).toContain('&lt;b&gt;BizzCMS&lt;/b&gt;')
  })

  it('applies the shared layout (color-scheme meta + hook classes)', () => {
    const out = renderTestEmail({ siteName: 'BizzCMS' })
    expect(out.html).toContain('color-scheme')
    expect(out.html).toContain('email-card')
    expect(out.html).toContain('email-heading')
  })
})
