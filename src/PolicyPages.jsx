import './policy.css'

const policies = {
  shipping: {
    eyebrow: 'Customer policy',
    title: 'Shipping Policy',
    sections: [
      ['Service area', 'Orders are currently shipped only to addresses in the United States. We use USPS Priority Mail unless a different service is shown during checkout.'],
      ['Rates and timing', 'Shipping is $10.99. Orders with a discounted product subtotal of $175 or more receive free shipping. The usual transit estimate is 2–3 business days after processing; carrier estimates are not guarantees.'],
      ['Tracking and address changes', 'Tracking details are sent after shipment. Contact support immediately if an address needs correction; an address cannot be changed after carrier acceptance.'],
      ['Loss or damage', 'Photograph damaged packaging and products and contact support within 48 hours of delivery. Insured shipments are eligible for replacement or refund after the carrier claim is verified.'],
    ],
  },
  refunds: {
    eyebrow: 'Customer policy',
    title: 'Refund Policy',
    sections: [
      ['Before fulfillment', 'Contact support as soon as possible. An order that has not entered processing may be cancelled and refunded to the original payment method.'],
      ['After shipment', 'For integrity and chain-of-custody reasons, research materials cannot be returned without prior written authorization. Eligibility is reviewed based on order status, product condition, and applicable law.'],
      ['Damage, loss, or incorrect items', 'Report an incorrect or damaged shipment within 48 hours and include the order number and clear photographs. Verified claims may be resolved with a replacement or refund. Insured carrier losses are handled after claim verification.'],
      ['Refund timing', 'Approved refunds are submitted to the original payment method. Stripe and the card issuer control the time required for the credit to appear. Shipping charges are refunded only when required by law or when the shipment error is ours.'],
    ],
  },
  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    sections: [
      ['Information we collect', 'We collect contact, billing, shipping, order, account, support, fraud-prevention, and technical information needed to operate the store. Payment card details are collected and processed by Stripe and are not stored by this website.'],
      ['How information is used', 'Information is used to process and fulfill orders, provide support, prevent fraud, meet legal obligations, improve reliability, and communicate about a transaction. Marketing messages are sent only where permitted and can be unsubscribed from.'],
      ['Service providers and disclosure', 'We share only the information necessary with processors such as Stripe, Supabase, hosting, shipping, monitoring, and professional advisers. We may disclose information when required by law or to protect customers and the service.'],
      ['Retention and security', 'Records are retained only as long as needed for fulfillment, tax, accounting, dispute, safety, and legal obligations. Access is restricted, administrative accounts require multi-factor authentication, and sensitive server credentials are never shipped to the browser.'],
      ['Your choices', 'You may request access, correction, or deletion where applicable by contacting info@purehealthpeptides.com. Some records must be retained for legal, security, or transaction requirements.'],
    ],
  },
  terms: {
    eyebrow: 'Legal',
    title: 'Terms and Conditions',
    sections: [
      ['Research use only', 'Products are sold solely for legitimate in vitro laboratory research and are not for human or veterinary use, diagnosis, treatment, food, drugs, cosmetics, or household use. Purchasers must be at least 21 and qualified to handle the materials.'],
      ['Orders and payment', 'Submitting an order is an offer to purchase. We may reject or cancel an order for availability, compliance, pricing, fraud, or legal reasons. Prices and shipping shown by the server-controlled checkout govern the transaction.'],
      ['Purchaser responsibilities', 'The purchaser is responsible for safe handling, storage, disposal, institutional approvals, and compliance with all laws and regulations in the relevant jurisdiction. Products may not be resold or represented for an unauthorized use.'],
      ['Site content and availability', 'Catalog and educational content is general information, not medical or professional advice. We may correct errors and change availability. Product batch documentation controls where it conflicts with general site content.'],
      ['Liability and disputes', 'To the extent permitted by law, liability is limited to the amount paid for the affected order. Rights that cannot legally be excluded remain unaffected. Contact support first so concerns can be investigated promptly.'],
    ],
  },
}

export default function PolicyPage({ type }) {
  const policy = policies[type]
  if (!policy) return null
  return (
    <article className="policy-page">
      <header>
        <span>{policy.eyebrow}</span>
        <h1>{policy.title}</h1>
        <p>Effective July 20, 2026</p>
      </header>
      <div className="policy-content">
        {policy.sections.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
        <section>
          <h2>Contact</h2>
          <p>Questions may be sent to <a href="mailto:info@purehealthpeptides.com">info@purehealthpeptides.com</a>.</p>
        </section>
      </div>
    </article>
  )
}
