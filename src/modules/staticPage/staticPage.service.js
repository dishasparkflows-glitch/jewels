const StaticPage = require('./staticPage.model');
const ApiError = require('../../utils/ApiError');

const DEFAULT_PAGES = [
  {
    title: 'Our Story',
    slug: 'our-story',
    status: 'published',
    seoTitle: 'Our Story | Neirah - Handcrafted Luxury Jewellery',
    metaDescription: 'Discover the story behind Neirah. Handcrafted luxury fine jewellery with timeless designs, ethical sourcing and modern elegance.',
    content: `<h2>The Art of Timeless Elegance</h2>
<p>At Neirah, we believe jewellery is more than an ornament — it is a reflection of your journey, your strength, and your unique story. Every piece we create is a celebration of craftsmanship, timeless design, and modern elegance.</p>
<p>Our collections are thoughtfully designed for the modern woman, blending heritage artistry with contemporary aesthetics. From everyday essentials to statement pieces, Neirah is committed to bringing you jewellery that shines with meaning and excellence.</p>
<div style="margin: 32px 0;">
  <img src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80" alt="Neirah Handcrafted Pendant" style="border-radius: 16px; width: 100%; max-height: 400px; object-fit: cover;" />
</div>
<h3>Our Values</h3>
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-top: 20px;">
  <div style="background: rgba(210, 177, 138, 0.08); padding: 20px; border-radius: 12px; border: 1px solid rgba(210, 177, 138, 0.2);">
    <h4 style="color: #b58838; margin-bottom: 8px;">💎 Exceptional Craftsmanship</h4>
    <p style="font-size: 14px; color: #64748b; margin: 0;">Meticulously designed with attention to every detail.</p>
  </div>
  <div style="background: rgba(210, 177, 138, 0.08); padding: 20px; border-radius: 12px; border: 1px solid rgba(210, 177, 138, 0.2);">
    <h4 style="color: #b58838; margin-bottom: 8px;">🪷 Ethical Sourcing</h4>
    <p style="font-size: 14px; color: #64748b; margin: 0;">Responsibly sourced materials for a better tomorrow.</p>
  </div>
  <div style="background: rgba(210, 177, 138, 0.08); padding: 20px; border-radius: 12px; border: 1px solid rgba(210, 177, 138, 0.2);">
    <h4 style="color: #b58838; margin-bottom: 8px;">🤍 Timeless Designs</h4>
    <p style="font-size: 14px; color: #64748b; margin: 0;">Jewellery that stays beautiful generation after generation.</p>
  </div>
</div>`,
    order: 1,
  },
  {
    title: 'Shipping Policy',
    slug: 'shipping-policy',
    status: 'published',
    seoTitle: 'Shipping Policy | Neirah Fine Jewellery',
    metaDescription: 'Read about our complimentary insured domestic shipping, processing times, and reliable courier partners across India.',
    content: `<div style="background: rgba(210, 177, 138, 0.08); padding: 24px; border-radius: 16px; border: 1px solid rgba(210, 177, 138, 0.2); margin-bottom: 24px; font-size: 15px;">
  Neirah offers fully insured, complimentary shipping on all domestic orders across India.
</div>

<div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 20px;">
  <h3 style="font-size: 18px; margin-top: 0; margin-bottom: 12px; font-weight: 700;">1. Processing Time</h3>
  <p style="margin: 0; color: #475569; line-height: 1.6;">All orders are processed within 1–2 business days (excluding weekends and public holidays) after receiving your order confirmation email. Custom engravings or made-to-order pieces may require an additional 3–5 working days.</p>
</div>

<div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 20px;">
  <h3 style="font-size: 18px; margin-top: 0; margin-bottom: 12px; font-weight: 700;">2. Shipping Rates & Couriers</h3>
  <p style="margin: 0; color: #475569; line-height: 1.6;">Standard domestic shipping within India is completely free. We partner with reputed secure logistics partners including Blue Dart and Sequel Logistics. Every parcel is sent in tamper-evident, discreet luxury packaging and requires a signature upon delivery.</p>
</div>

<div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 20px;">
  <h3 style="font-size: 18px; margin-top: 0; margin-bottom: 12px; font-weight: 700;">3. Delivery Estimates</h3>
  <p style="margin: 0 0 10px 0; color: #475569; line-height: 1.6;">
    • Metro Cities: 2–4 business days<br/>
    • Rest of India: 5–7 business days<br/>
    • Remote Areas: 7–9 business days
  </p>
  <p style="margin: 0; font-size: 13px; color: #94a3b8;">*Delivery timelines are subject to courier serviceability and local regulations.</p>
</div>

<div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; background: #fafaf9;">
  <h3 style="font-size: 18px; margin-top: 0; margin-bottom: 12px; font-weight: 700;">Need Assistance?</h3>
  <p style="margin: 0; color: #475569; line-height: 1.6;">For any shipping-related queries or urgent delivery requests, feel free to contact us:</p>
  <p style="margin: 10px 0 0 0; font-weight: 600; color: #1c1917;">Neirah By Zunzar Jewellers</p>
  <p style="margin: 4px 0 0 0; color: #475569; font-size: 14px;">Email: care@neirahjewels.com | Phone: +91 84600 91955</p>
</div>`,
    order: 2,
  },
  {
    title: 'Return & Refund Policy',
    slug: 'return-refund-policy',
    status: 'published',
    seoTitle: 'Return & Refund Policy | Neirah Fine Jewellery',
    metaDescription: 'Learn about our 15-day return policy, hassle-free pickup and 100% refund terms.',
    content: `<h2>15-Day Hassle-Free Returns</h2>
<p>We want you to fall in love with every piece from Neirah. If you are not completely enchanted with your purchase, we gladly offer a complimentary 15-day return window from the date of delivery.</p>
<div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin: 20px 0;">
  <h3>Eligibility Criteria</h3>
  <ul style="line-height: 1.8; color: #475569;">
    <li>Item must be unused, in its original pristine condition, and with all security tags intact.</li>
    <li>Must include the original Neirah luxury packaging, authenticity certificate, and invoice.</li>
    <li>Custom-made or personalized engraved items cannot be returned.</li>
  </ul>
</div>
<div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin: 20px 0;">
  <h3>Refund Process</h3>
  <p>Once your returned item arrives at our atelier and passes our quality inspection, your refund will be processed to the original payment method within 5–7 business days.</p>
</div>`,
    order: 3,
  },
  {
    title: 'Cancellation Policy',
    slug: 'cancellation-policy',
    status: 'published',
    seoTitle: 'Cancellation Policy | Neirah',
    metaDescription: 'Order cancellation terms and procedures at Neirah.',
    content: `<h2>Order Cancellations</h2>
<p>Orders may be cancelled within 12 hours of placement, prior to dispatch or personalization processing. To cancel, please reach out via our WhatsApp concierge or customer support email.</p>`,
    order: 4,
  },
  {
    title: 'Terms & Conditions',
    slug: 'terms-conditions',
    status: 'published',
    seoTitle: 'Terms & Conditions | Neirah',
    metaDescription: 'Terms of service and user agreement for Neirah Jewels.',
    content: `<h2>Terms of Service</h2>
<p>Welcome to Neirah. By accessing our website and purchasing our fine jewellery, you agree to comply with and be bound by the following terms and conditions.</p>`,
    order: 5,
  },
  {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    status: 'published',
    seoTitle: 'Privacy Policy | Neirah Jewels',
    metaDescription: 'How we safeguard your personal information and privacy.',
    content: `<h2>Your Privacy is Sacred to Us</h2>
<p>At Neirah, we adhere strictly to international data privacy best practices. We never sell, rent, or trade your personal information to third parties.</p>`,
    order: 6,
  },
  {
    title: 'Jewellery Care',
    slug: 'jewellery-care',
    status: 'published',
    seoTitle: 'Jewellery Care & Maintenance | Neirah',
    metaDescription: 'Expert tips on cleaning, storing, and maintaining your gold and diamond jewellery.',
    content: `<h2>Preserving Your Heirloom’s Radiance</h2>
<p>Fine jewellery is crafted to be cherished forever. Daily exposure to cosmetics, oils, and environmental factors can temporarily dull its pristine sparkle. Here are essential rituals recommended by our master jewellers.</p>`,
    order: 7,
  },
  {
    title: "FAQ's",
    slug: 'faqs',
    status: 'published',
    seoTitle: 'Frequently Asked Questions | Neirah',
    metaDescription: 'Got questions? Find clear answers regarding orders, sizing, certificates and diamond care.',
    content: `<h2>Frequently Asked Questions</h2>
<p>Find answers to common questions about our jewellery, certificates, ring sizing, and doorstep delivery.</p>`,
    order: 8,
  },
  {
    title: 'Track Your Order',
    slug: 'track-your-order',
    status: 'published',
    seoTitle: 'Track Your Order | Neirah',
    metaDescription: 'Track your secure shipment status in real time.',
    content: `<h2>Real-Time Order Tracking</h2>
<p>Enter your order ID and registered mobile number to check the live tracking status of your insured delivery.</p>`,
    order: 9,
  },
  {
    title: 'Corporate',
    slug: 'corporate',
    status: 'published',
    seoTitle: 'Corporate Gifting & Partnerships | Neirah',
    metaDescription: 'Bespoke corporate gifting solutions in fine jewellery by Neirah.',
    content: `<h2>Corporate & Bespoke Gifting</h2>
<p>Celebrate milestone achievements with handcrafted luxury jewellery personalized for your team and distinguished partners.</p>`,
    order: 10,
  },
  {
    title: 'Contact Us',
    slug: 'contact-us',
    status: 'published',
    seoTitle: 'Contact Us | Neirah Luxury Jewellery',
    metaDescription: 'Reach our concierge for inquiries, custom orders, or personal appointments.',
    content: `<h2>Get in Touch with Our Concierge</h2>
<p>Our client advisors are delighted to assist with diamond selection, custom commissions, or appointment booking.</p>`,
    order: 11,
  },
];

class StaticPageService {
  /**
   * Normalize page slug
   */
  _normalizeSlug(slug, title) {
    const raw = slug || title || '';
    return raw
      .toLowerCase()
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Seed default pages if collection is empty
   */
  async ensureSeedDefaults() {
    const count = await StaticPage.countDocuments();
    if (count === 0) {
      await StaticPage.insertMany(DEFAULT_PAGES);
    }
  }

  /**
   * Get all static pages (with search & status filter)
   */
  async getAll(query = {}) {
    await this.ensureSeedDefaults();

    const filter = {};
    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ title: searchRegex }, { slug: searchRegex }, { seoTitle: searchRegex }];
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    const pages = await StaticPage.find(filter).sort({ order: 1, updatedAt: -1 });
    return pages;
  }

  /**
   * Get page by ID
   */
  async getOne(id) {
    const page = await StaticPage.findById(id);
    if (!page) {
      throw new ApiError(404, 'Static page not found');
    }
    return page;
  }

  /**
   * Get page by slug (public view)
   */
  async getBySlug(rawSlug) {
    await this.ensureSeedDefaults();

    const slug = this._normalizeSlug(rawSlug);
    const page = await StaticPage.findOne({
      slug,
      status: { $in: ['published', 'active'] },
    });

    if (!page) {
      throw new ApiError(404, `Page with slug '${slug}' not found`);
    }
    return page;
  }

  /**
   * Create a new static page
   */
  async create(data) {
    const payload = { ...data };
    payload.slug = this._normalizeSlug(payload.slug, payload.title);

    if (!payload.slug) {
      throw new ApiError(400, 'Please provide a valid page title or URL slug');
    }

    // Check slug uniqueness
    const existing = await StaticPage.findOne({ slug: payload.slug });
    if (existing) {
      throw new ApiError(400, `A page with URL slug '/${payload.slug}' already exists`);
    }

    const page = await StaticPage.create(payload);
    return page;
  }

  /**
   * Update an existing static page
   */
  async update(id, data) {
    const page = await StaticPage.findById(id);
    if (!page) {
      throw new ApiError(404, 'Static page not found');
    }

    const payload = { ...data };
    if (payload.slug) {
      payload.slug = this._normalizeSlug(payload.slug, payload.title);
      // Check duplicate slug if slug changed
      if (payload.slug !== page.slug) {
        const existing = await StaticPage.findOne({ slug: payload.slug, _id: { $ne: id } });
        if (existing) {
          throw new ApiError(400, `A page with URL slug '/${payload.slug}' already exists`);
        }
      }
    }

    Object.assign(page, payload);
    await page.save();
    return page;
  }

  /**
   * Delete a static page
   */
  async delete(id) {
    const page = await StaticPage.findByIdAndDelete(id);
    if (!page) {
      throw new ApiError(404, 'Static page not found');
    }
    return { id, message: 'Static page deleted successfully' };
  }
}

module.exports = new StaticPageService();
