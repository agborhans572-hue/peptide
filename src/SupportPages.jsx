import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { postToSiteService, safeServiceMessage, siteServices } from './siteServices.js'
import './support.css'

const faqCategories = [
  {
    title: 'Product Information',
    items: [
      ['What are peptides?', 'Peptides are short chains of amino acids linked by peptide bonds. They serve as biological messengers that regulate various physiological functions such as metabolism, immune response, and cellular repair. Peptides are widely researched in fields like regenerative medicine, anti-aging, and metabolic studies.'],
      ['How do peptides differ from proteins?', 'Peptides are shorter in length than proteins, typically consisting of 2-50 amino acids, while proteins are composed of longer chains, often exceeding 50 amino acids. Peptides usually act as signaling molecules, whereas proteins have structural or enzymatic roles in the body.'],
      ['What types of peptides do you offer?', 'Pure Health Peptides offers a wide range of research peptides, categorized into research areas such as:\n\n• Oncology & Cell Fate\n• Regeneration & Longevity\n• Growth & Repair\n• Cognitive & Neuro\n• Dermal, Hair & Tissue Appearance\n• Immune & Inflammatory\n• Metabolic\n• Reproductive & Neuroendocrine\n• Mitochondrial & Cellular Energy'],
      ['Are your peptides synthetic or naturally derived?', 'All peptides offered by Pure Health Peptides are synthetically produced using state-of-the-art peptide synthesis technology. This ensures high purity, batch consistency, and stability for research applications.'],
      ['What is the purity level of your peptides?', 'Our peptides have a purity level of ≥99%, verified through High-Performance Liquid Chromatography (HPLC) and Mass Spectrometry (MS) analysis.'],
      ['How do you verify the quality and purity of your peptides?', 'Every batch is tested for purity, molecular integrity, and contaminants, with results documented in a Certificate of Analysis (CoA).'],
      ['Do you provide Certificates of Analysis (CoA) for your peptides?', 'Yes, each batch of peptides comes with a Certificate of Analysis (CoA) that verifies its purity, molecular composition, and batch-specific testing results. These CoA’s are available in our COA Library on the website.'],
      ['How should I store lyophilized peptides?', 'Before reconstitution: Store lyophilized peptides at -20°C (-4°F) for long-term stability.\n\nAfter reconstitution: Keep at 2-8°C (36-46°F) and use promptly to maintain integrity.'],
      ['What solvents should I use for peptide reconstitution?', 'The appropriate solvent depends on the peptide’s properties:\n\n• Bacteriostatic Water (BW): Commonly used for most peptides.\n• Acetic Acid (0.6% or 1%): Recommended for peptides with solubility issues.\n• DMSO (Dimethyl Sulfoxide): Used for specific hydrophobic peptides.\n\nNote: We offer bacteriostatic water in our shop for peptide reconstitution.'],
      ['Do you offer pre-reconstituted peptides?', 'No, all peptides are provided in lyophilized powder form to ensure stability and a longer shelf life. Researchers are responsible for reconstitution.'],
      ['How long do reconstituted peptides remain stable?', 'Stored at 2-8°C (36-46°F), most peptides remain stable for 28 days. It is recommended that they are being used within this timeframe.'],
      ['Do peptides degrade over time?', 'Yes, peptides naturally degrade due to moisture, heat, and light exposure. Proper storage conditions help maintain their stability and research effectiveness.'],
      ['Are your peptides sterile?', 'Our peptides are produced under controlled conditions and tested to meet research-grade purity standards. However, they are strictly for research use only and not intended for human or veterinary applications.'],
      ['Do your peptides contain additives or preservatives?', 'No, our peptides are free from unnecessary additives, fillers, or preservatives, ensuring high-purity compounds for research applications.'],
      ['What is the difference between lyophilized and liquid peptides?', '• Lyophilized peptides (freeze-dried powder) have a longer shelf life and remain stable until reconstituted.\n• Liquid peptides are pre-mixed but degrade faster, making them less suitable for long-term storage.\n• We only offer lyophilized peptides to ensure maximum stability and shelf life.'],
      ['Can I request a specific peptide that is not listed on your website?', 'Yes, we are constantly expanding our catalog. If you need a specific peptide, contact us to inquire about special orders or upcoming availability.'],
      ['Do you offer custom peptide synthesis services?', 'At this time, we do not offer custom peptide synthesis, but we may consider special requests for bulk orders or research collaborations.'],
      ['Do you provide peptide blends, or must they be purchased separately?', 'We offer pre-formulated peptide blends designed for specific research purposes, such as:\n\n• BPC-157/TB-500 Blend\n• CJC-1295/Ipamorelin Blend\n• GHK-Cu/Epithalon Blend (coming soon)\n• BPC-157/GHK-Cu/TB-500 (“GLOW”) (coming soon)\n• CJC-1295/GHRP-6 Blend (coming soon)'],
    ],
  },
  {
    title: 'Pricing & Discounts',
    items: [
      ['How are your peptides priced?', 'At Pure Health Peptides, we offer the absolute best price per vial—no gimmicks, no hidden fees, and no need for coupon codes. Our straightforward pricing structure ensures high-quality research peptides at unbeatable prices without the hassle of promotions or temporary discounts.'],
      ['Do you offer bulk order discounts?', 'Yes! Our no-hassle volume discounts mean the more you buy, the less you pay. We automatically apply a 1% discount per extra vial purchased, up to a maximum of 25% off. Unlike other companies, there’s no need for coupon codes or promotions—our best price is always available to every customer, every time.'],
      ['Do you have a wholesale program?', 'We don’t require a separate wholesale program because our volume discounts automatically create wholesale pricing! Whether you’re purchasing a single vial or a large order, you’re already getting the best possible price, with discounts increasing as you buy more.'],
      ['Can I get a discount if I’m a repeat customer?', 'Every customer—whether new or returning—automatically receives the best price per vial from the start. There’s no need to wait for special promotions or customer loyalty programs. We believe in transparent, everyday low pricing with volume discounts that reward larger purchases.'],
      ['Do you offer any promotions or special deals?', 'We don’t play the promo code game—we simply offer the best price upfront. Unlike companies that inflate their prices only to offer random discounts, our pricing is designed to be fair and consistent. Plus, our volume discounts ensure you get the lowest possible price per vial—every single time.'],
      ['How do I apply a coupon code at checkout?', 'You don’t have to! With Pure Health Peptides, there are no coupon codes, no limited-time offers, and no gimmicks. Our automatic volume discounts apply instantly, so you never have to search for deals.'],
      ['Do you price match with other peptide suppliers?', 'We don’t need to—we already offer the best price per vial with no tricks or hidden costs. Our straightforward pricing and volume discount structure mean that you’re always paying the lowest possible price without having to compare with competitors.'],
      ['Do you have a rewards or loyalty program?', 'Our volume discount structure is our loyalty program! Instead of making customers jump through hoops, we ensure that every order gets the best possible price. The more vials you buy, the more you save—up to 25% off per order.'],
      ['Are there extra costs for custom peptide synthesis?', 'Custom peptide synthesis requires specialized production and additional costs based on sequence complexity, purity level, and batch size. If you need a custom peptide, contact us for a personalized quote.'],
      ['Can I request a quote for large-volume orders?', 'Our automatic volume discounts already provide wholesale pricing, so there’s no need to request a quote in most cases. However, if you’re making an exceptionally large purchase, feel free to reach out, and we’ll see if additional pricing options are available.'],
    ],
  },
  {
    title: 'Shipping & Processing',
    items: [
      ['Where do you ship from?', 'All orders are processed and shipped from our U.S.-based facility in California (CA) to ensure fast and reliable delivery.'],
      ['Do you ship internationally?', 'No, we do not ship internationally. We only ship within the United States.'],
      ['How much does shipping cost?', 'We offer a simple, flat-rate shipping fee of $10.99 for all domestic orders. Orders over $175 (Net Product Value, after discounts and before fees) qualify for free shipping.'],
      ['What shipping carriers do you use?', 'We exclusively use USPS Priority Mail because it offers the best combination of:\n\n✔ Fast delivery (2-3 business days)\n✔ Secure and reliable service\n✔ Convenient mailbox and PO Box deliveries (no packages left unattended)'],
      ['How long does it take to process an order?', 'Orders placed before 11:00 AM PST are typically processed and shipped the same business day.'],
      ['Can I track my order?', 'Yes! Once your order ships, you will receive a tracking number via email, allowing you to monitor the status of your package.'],
      ['Do you offer expedited shipping options?', 'Because we use USPS Priority Mail, our standard shipping already provides fast delivery within 2-3 business days. Additional expedited options are not necessary.'],
      ['Do you ship to PO boxes?', 'Yes! We ship to PO boxes, thanks to USPS Priority Mail.'],
      ['What should I do if my package is lost or delayed?', 'If you selected optional shipping insurance ($2.99), your shipment is fully covered against loss and damages.\n\nIf your insured package is lost or damaged, we will issue a replacement or refund at no additional cost.\n\nIf no insurance was selected, Pure Health Peptides is not responsible for carrier delays or lost shipments.'],
      ['Do you offer discreet packaging?', 'Yes! All shipments are sent in plain, discreet packaging with no mention of peptide-related contents to ensure privacy.'],
      ['What happens if my package is damaged during shipping?', '• If you purchased shipping insurance: Your package is fully covered, and we will replace or refund your order.\n• If no insurance was purchased: Pure Health Peptides is not liable for damages caused by the carrier.\n• If you receive a damaged package, please take photos and contact us within 48 hours of delivery.'],
      ['Can I change my shipping address after placing an order?', 'If your order has not yet shipped, we may be able to update the shipping address. Please contact us immediately after placing your order. Once an order has shipped, we cannot change the delivery address.'],
      ['Do you offer free shipping for large orders?', 'Yes! Orders over $175 qualify for free USPS Priority Mail shipping.'],
      ['What is the estimated delivery time for domestic orders?', 'We use USPS Priority Mail, which delivers within 2-3 business days across the U.S.'],
      ['What is the estimated delivery time for international orders?', 'We do not ship internationally at this time.'],
      ['Do you provide order confirmation emails?', 'Yes! After placing your order, you will receive an order confirmation email with details of your purchase. A shipping confirmation email with tracking information will follow once your order has shipped.'],
      ['Can I pick up my order in person?', 'No, we currently do not offer in-person pickups. All orders must be shipped.'],
    ],
  },
  {
    title: 'Quality & Safety',
    items: [
      ['Are your peptides tested for contaminants?', 'Yes! Every batch undergoes quality control testing, including microbial analysis to confirm the absence of contaminants. Full details are available in the Certificate of Analysis (CoA).'],
      ['How do you ensure the purity of your peptides?', 'Every batch is tested for purity, molecular integrity, and contaminants, with results documented in a Certificate of Analysis (CoA).'],
      ['Are your peptides third-party tested?', 'Yes. All third-party testing is conducted in the USA under strict regulatory standards. Testing confirms purity, molecular integrity, and identity, with results documented in the Certificate of Analysis (CoA).'],
      ['How do I know if my peptide is authentic?', 'You can verify the authenticity of your peptide by checking:\n\n✔ The Certificate of Analysis (CoA) – Confirms purity and batch testing\n✔ The molecular structure & solubility – Matches expected research characteristics\n✔ The batch number ID check – Each vial comes with a batch number that can be verified on the CoA.\n\nWe are committed to full transparency, and each product batch is tested and documented to meet our high-quality standards.'],
      ['How often do you update Certificates of Analysis (CoA’s)?', 'We update our CoA’s for every new batch produced. Each CoA reflects the latest batch specific purity and identity testing results for the most recent production run. CoA’s are available in our COA Library for full transparency.'],
      ['What should I do if I suspect my peptide has been compromised?', 'If you believe your peptide has been damaged, contaminated, or compromised, please:\n\n✔ Inspect the packaging for any signs of tampering or leakage\n✔ Check the CoA to confirm expected purity, batch number and appearance\n✔ Contact our support team immediately for further assistance\n\nWe stand by the quality of our peptides and will address any concerns swiftly.'],
    ],
  },
  {
    title: 'Legal & Compliance',
    items: [
      ['Are your peptides FDA-approved?', 'No. Our peptides are for research purposes only and have not been evaluated or approved by the FDA for human or veterinary use. Any non-research application may violate federal, state, or local regulations.'],
      ['Can I use your peptides for human consumption?', 'No. Our peptides are strictly for research purposes only and are not intended for human or veterinary consumption, injection, or treatment. Misuse of these products is strictly prohibited and may violate federal, state, or local laws.'],
      ['Do I need a prescription to buy peptides from your site?', 'No prescription is required to purchase our peptides, as they are sold exclusively for laboratory research purposes. However, it is the responsibility of the buyer to ensure compliance with all applicable laws and regulations in their jurisdiction.'],
      ['What does "For Research Use Only" mean?', '“For Research Use Only” means that our peptides are intended exclusively for laboratory research and in vitro studies. They are not intended for human or veterinary use, medical treatment, or consumption.'],
      ['Why can’t you provide dosage or usage instructions?', 'Because our peptides are for research use only, providing dosage, administration, or application guidelines would be a violation of FDA regulations. We do not support or endorse the use of these peptides outside of laboratory research settings.'],
      ['Do you comply with cGMP (Current Good Manufacturing Practice) regulations?', 'Yes! Our suppliers and partners are cGMP-certified, ensuring that all peptides are manufactured under strict quality control standards to maintain purity, consistency, and safety for research applications.'],
      ['How does your company ensure compliance with regulatory guidelines?', 'We follow strict FDA-compliant policies, including:\n\n✔ Labeling all products “For Research Use Only”\n✔ Prohibiting human or veterinary consumption\n✔ Manufacturing peptides in ISO & cGMP-certified facilities\n✔ Conducting U.S.-based third-party testing\n\nWe operate with full transparency and do not provide medical advice, dosage information, or treatment recommendations.'],
      ['Why am I banned from your website?', 'Pure Health Peptides reserves the right to restrict access to users who violate our policies, attempt to misuse our products, or engage in fraudulent or suspicious activities. Common reasons for being banned include:\n\n• Misuse of Products\n• Fraudulent Transactions\n• Violation of Terms & Policies\n• Regulatory Compliance Issues.\n\nIf you believe you have been mistakenly banned, please contact our support team for further assistance.'],
      ['If you have any other questions for us?', 'For all other general inquiries, please feel free to contact us at info@purehealthpeptides.com. However, we strictly cannot provide any guidance, recommendations, or answers related to dosage, administration, regimens, or personal use in any form. All our products are for research purposes only.'],
    ],
  },
]

function FormStatus({ children }) {
  return children ? <p className="support-form-status" role="status">{children}</p> : null
}

export function AccountPage() {
  const [loginStatus, setLoginStatus] = useState('')
  const [accountStatus, setAccountStatus] = useState('')

  function handleLogin(event, method) {
    event.preventDefault()
    const username = new FormData(event.currentTarget).get('username')?.toString().trim()
    if (!username) {
      setLoginStatus('Enter your username or email address.')
      return
    }
    if (!siteServices.accountPortalUrl) {
      setLoginStatus(`${method} login is not connected on this deployment. Email info@purehealthpeptides.com for account support.`)
      return
    }
    window.location.assign(siteServices.accountPortalUrl)
  }

  function handleAccount(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    if (!siteServices.accountPortalUrl) {
      setAccountStatus('Account registration is not connected on this deployment. Email info@purehealthpeptides.com for account support.')
      return
    }
    window.location.assign(siteServices.accountPortalUrl)
  }

  function handleOtp(event) {
    const form = event.currentTarget.closest('form')
    const username = new FormData(form).get('username')?.toString().trim()
    if (!username) {
      setLoginStatus('Enter your username or email address before requesting an OTP.')
      return
    }
    if (!siteServices.accountPortalUrl) {
      setLoginStatus('OTP login is not connected on this deployment. Email info@purehealthpeptides.com for account support.')
      return
    }
    window.location.assign(siteServices.accountPortalUrl)
  }

  return (
    <div className="support-page account-page">
      <section className="account-layout">
        <article>
          <h1>Login</h1>
          <form className="account-card" onSubmit={(event) => handleLogin(event, 'Password')}>
            <label>Username or email address <span>*</span><input name="username" type="text" /></label>
            <label className="remember-field"><input name="rememberme" type="checkbox" /> Remember me</label>
            <div className="account-login-actions">
              <button type="button" onClick={handleOtp}>LOGIN WITH OTP</button>
              <button type="submit">LOGIN WITH PASSWORD</button>
            </div>
            <FormStatus>{loginStatus}</FormStatus>
          </form>
        </article>

        <article>
          <h1>Create an Account</h1>
          <form className="account-card create-account-card" onSubmit={handleAccount}>
            <div className="account-name-grid">
              <label>First Name <span>*</span><input name="first_name" type="text" required /></label>
              <label>Last Name <span>*</span><input name="last_name" type="text" required /></label>
            </div>
            <label>Phone Number <span>*</span><input name="phone" type="tel" required /></label>
            <label>Email address <span>*</span><input name="email" type="email" required /></label>
            <label>Business Name<input name="business_name" type="text" /></label>
            <label>EIN<input name="ein" type="text" /></label>
            <label>Website URL<input name="website_url" type="url" /></label>
            <button className="account-send-otp" type="button" onClick={() => {
              if (siteServices.accountPortalUrl) window.location.assign(siteServices.accountPortalUrl)
              else setAccountStatus('OTP registration is not connected on this deployment. Email info@purehealthpeptides.com for account support.')
            }}>CLICK HERE TO SEND OTP</button>
            <p>A link to set a new password will be sent to your email address.</p>
            <label>Enter Code <span>*</span><input name="moverify" type="text" required /></label>
            <p>Your personal data will be used to support your experience throughout this website, to manage access to your account, and for other purposes described in our <a href="https://purehealthpeptides.com/privacy-policy/">privacy policy</a>.</p>
            <button className="account-create" type="submit">CREATE ACCOUNT</button>
            <FormStatus>{accountStatus}</FormStatus>
          </form>
        </article>
      </section>
    </div>
  )
}

export function TrackOrderPage() {
  const [status, setStatus] = useState('')

  async function track(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    if (!siteServices.orderTrackingEndpoint) {
      setStatus('Order lookup is not connected on this deployment. Email info@purehealthpeptides.com for order support.')
      return
    }

    const values = Object.fromEntries(new FormData(event.currentTarget))
    setStatus('Looking up your order…')
    try {
      const result = await postToSiteService(siteServices.orderTrackingEndpoint, values)
      setStatus(result.message || result.status || 'Order lookup completed. Check your email for tracking details.')
    } catch (error) {
      setStatus(safeServiceMessage(error, 'Order lookup failed. Please try again or email support.'))
    }
  }

  return (
    <div className="support-page track-page">
      <section className="track-content">
        <h1>Track Order</h1>
        <p>To track your order please enter your Order ID in the box below and press the "Track" button. This was given to you on your receipt and in the confirmation email you should have received.</p>
        <form onSubmit={track}>
          <label>Order ID<input name="orderid" type="text" placeholder="Found in your order confirmation email." required /></label>
          <label>Billing email<input name="order_email" type="email" placeholder="Email you used during checkout." required /></label>
          <button type="submit">TRACK</button>
        </form>
        <FormStatus>{status}</FormStatus>
      </section>
    </div>
  )
}

export function FaqPage() {
  const initialOpen = faqCategories.map((_, index) => `${index}-0`)
  const [openItems, setOpenItems] = useState(initialOpen)
  let questionNumber = 0

  function toggle(key) {
    setOpenItems((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }

  return (
    <div className="support-page faq-page">
      <section className="faq-content">
        <h1>frequently asked questions</h1>
        {faqCategories.map((category, categoryIndex) => (
          <section className="faq-category" key={category.title}>
            <h2>{category.title}</h2>
            {category.items.map(([question, answer], itemIndex) => {
              questionNumber += 1
              const number = questionNumber
              const key = `${categoryIndex}-${itemIndex}`
              const open = openItems.includes(key)
              return (
                <article className={open ? 'is-open' : ''} key={question}>
                  <button type="button" aria-expanded={open} onClick={() => toggle(key)}>
                    <span>{number}. {question}</span><ChevronDown aria-hidden="true" />
                  </button>
                  <div className="faq-answer"><p>{answer}</p></div>
                </article>
              )
            })}
          </section>
        ))}
        <section className="faq-legal">
          <h2>Legal Disclaimer:</h2>
          <p>“By purchasing from Pure Health Peptides, you acknowledge that these products are for laboratory research use only. Pure Health Peptides assumes no liability for misuse, improper handling, or applications outside of legally authorized research. Customers are responsible for ensuring compliance with all applicable laws in their jurisdiction.”</p>
        </section>
      </section>
    </div>
  )
}

export function ContactPage() {
  const [status, setStatus] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    if (!siteServices.contactEndpoint) {
      setStatus('Contact form delivery is not connected on this deployment. Please email info@purehealthpeptides.com.')
      return
    }

    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    setStatus('Sending your message…')
    try {
      await postToSiteService(siteServices.contactEndpoint, values)
      form.reset()
      setStatus('Thanks—your message was sent successfully.')
    } catch (error) {
      setStatus(safeServiceMessage(error, 'Your message could not be sent. Please try again or email support.'))
    }
  }

  return (
    <div className="support-page contact-page">
      <section className="contact-content">
        <h1>Send us a message</h1>
        <form onSubmit={submit}>
          <label className="sr-only" htmlFor="support-full-name">Full Name</label>
          <input id="support-full-name" name="full-name" type="text" placeholder="Full Name" required />
          <label className="sr-only" htmlFor="support-email">Email Address</label>
          <input id="support-email" name="email-address" type="email" placeholder="Email Address" required />
          <label className="sr-only" htmlFor="support-message">Your Message</label>
          <textarea id="support-message" name="your-message" placeholder="Your Message" required />
          <button type="submit">SEND MESSAGE</button>
        </form>
        <FormStatus>{status}</FormStatus>
      </section>
    </div>
  )
}
