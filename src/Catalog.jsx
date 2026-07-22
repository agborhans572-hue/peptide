import { shopProducts } from "./catalog.js";
import { productPath } from "./productRoutes.js";

const productById = new Map(shopProducts.map((product) => [product.id, product]));

export const homeCategories = [
  {
    key: "vials",
    heading: "vials",
    showLoadMore: true,
    products: [
      {
        name: "Bacteriostatic Water",
        productId: "vials-3635",
        image: "/assets/bacteriostatic-water.jpg",
        price: "$10.99",
      },
      {
        name: "GLP-3 (R)",
        productId: "vials-455",
        image: "/assets/glp-3r.jpg",
        price: "$57.00",
      },
      {
        name: "BPC-157",
        productId: "vials-419",
        image: "/assets/bpc-157.jpg",
        price: "$22.00",
      },
      {
        name: "BPC-157/TB-500",
        productId: "vials-422",
        image: "/assets/bpc-157-tb-500.jpg",
        price: "$52.00",
      },
      {
        name: "NAD+",
        productId: "vials-451",
        image: "/assets/nad-vial.jpg",
        price: "$25.00",
      },
      {
        name: "GHK-Cu",
        productId: "vials-433",
        image: "/assets/ghk-cu.jpg",
        price: "$29.00",
      },
      {
        name: "MOTS-c",
        productId: "vials-4680",
        image: "/assets/mots-c.jpg",
        price: "$37.00",
      },
      {
        name: "Tesamorelin",
        productId: "vials-470",
        image: "/assets/tesamorelin.jpg",
        price: "$47.00",
      },
    ],
  },
  {
    key: "capsules",
    heading: "capsules",
    showLoadMore: true,
    products: [
      {
        name: "DHX / PNB-0408",
        productId: "capsules-30666",
        image: "/assets/dihexa.jpg",
        price: "$79.00",
      },
      {
        name: "BPC-157 (Arginate Salt)",
        productId: "capsules-30650",
        image: "/assets/bpc-arginate.jpg",
        price: "$83.00",
      },
      {
        name: "SLU-PP-332",
        productId: "capsules-30663",
        image: "/assets/slu-pp-332.jpg",
        price: "$89.00",
      },
      {
        name: "BPC-157 / TB-500 (Tβ4) Blend",
        productId: "capsules-30652",
        image: "/assets/bpc-tb-capsule.jpg",
        price: "$129.00",
      },
      {
        name: "5-Amino-1MQ",
        productId: "capsules-30567",
        image: "/assets/5-amino-1mq.jpg",
        price: "$129.00",
      },
      {
        name: "Methylene Blue",
        productId: "capsules-30659",
        image: "/assets/methylene-blue.jpg",
        price: "$69.00",
      },
      {
        name: "GLOW",
        productId: "capsules-36443",
        image: "/assets/glow.png",
        price: "$149.00",
      },
      {
        name: "Ibutamorin",
        productId: "capsules-30661",
        image: "/assets/mk-677.jpg",
        price: "$89.00",
      },
    ],
  },
  {
    key: "liquids",
    heading: "liquids",
    showLoadMore: true,
    products: [
      {
        name: "LC 216 (Lipo-B formulation)",
        productId: "liquids-30560",
        image: "/assets/lc-216.jpg",
        price: "$49.00",
      },
      {
        name: "Semax",
        productId: "liquids-33349",
        image: "/assets/semax.jpg",
        price: "$114.00",
      },
      {
        name: "Selank TP-7",
        productId: "liquids-33353",
        image: "/assets/selank-tp-7.jpg",
        price: "$114.00",
      },
      {
        name: "PT-141",
        productId: "liquids-33354",
        image: "/assets/pt-141.jpg",
        price: "$119.00",
      },
      {
        name: "NAD+ (Nicotinamide Adenine Dinucleotide)",
        productId: "liquids-33348",
        image: "/assets/nad-liquid.jpg",
        price: "$114.00",
      },
      {
        name: "VOCUS",
        productId: "liquids-50723",
        image: "/assets/vocus.png",
        price: "$129.00",
      },
      {
        name: "BPC-157 / TB-500 (Tβ4)",
        productId: "liquids-33355",
        image: "/assets/bpc-tb-liquid.jpg",
        price: "$139.00",
      },
      {
        name: "LC 120 (Lipo-C formulation)",
        productId: "liquids-30551",
        image: "/assets/lc-120.jpg",
        price: "$44.00",
      },
    ],
  },
  {
    key: "topicals",
    heading: "topicals",
    showLoadMore: false,
    products: [
      {
        name: "Modular Peptide System A – Dual Peptide Serum",
        productId: "topicals-57217",
        image: "/assets/topical-a.jpg",
        price: "$71.00",
      },
      {
        name: "Modular Peptide System D – Copper-Peptide Complex",
        productId: "topicals-57242",
        image: "/assets/topical-d.jpg",
        price: "$109.00",
      },
      {
        name: "Complete Configuration – Modular Peptide Systems A+B+C+D+E",
        productId: "topicals-57263",
        image: "/assets/topical-complete.jpg",
        price: "$399.00",
      },
      {
        name: "Modular Peptide System C – Controlled-Rheology Peptide Emulsion",
        productId: "topicals-57238",
        image: "/assets/topical-c.jpg",
        price: "$79.00",
      },
      {
        name: "Modular Peptide System E – Multi-Peptide Complex",
        productId: "topicals-57250",
        image: "/assets/topical-e.jpg",
        price: "$129.00",
      },
      {
        name: "Phase 2 Configuration – Modular Peptide Systems B+D",
        productId: "topicals-57258",
        image: "/assets/topical-phase-2.jpg",
        price: "$179.00",
      },
      {
        name: "Modular Peptide System B – Pure Peptide Gel",
        productId: "topicals-57235",
        image: "/assets/topical-b.jpg",
        price: "$92.00",
      },
      {
        name: "Phase 1 Configuration – Modular Peptide Systems A+C+E",
        productId: "topicals-57256",
        image: "/assets/topical-phase-1.jpg",
        price: "$239.00",
      },
    ],
  },
];

function ProductCard({ product, onProduct }) {
  const shopProduct = productById.get(product.productId);

  if (!shopProduct) {
    throw new Error(`Homepage catalog product “${product.name}” references missing product ID ${product.productId}.`);
  }

  const handleLearnMore = (event) => {
    if (
      !onProduct
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onProduct(shopProduct);
  };

  return (
    <article className="product-card">
      <img
        className="product-image"
        src={product.image}
        alt={product.name}
        loading="lazy"
      />
      <div className="product-meta">
        <span className="product-price-label">Starting at</span>
        <span className="product-price">{product.price}</span>
        <span className="save-label">Order More, Save More</span>
        <a
          className="learn-button"
          href={productPath(shopProduct)}
          aria-label={`Learn More About ${product.name}`}
          onClick={handleLearnMore}
        >
          LEARN MORE
        </a>
      </div>
    </article>
  );
}

export default function Catalog({ onProduct, onShop }) {
  return (
    <section className="catalog" id="catalog">
      <h2 className="catalog-title">Shop All Products</h2>

      {homeCategories.map((category) => {
        return (
          <section
            className={`category-section ${category.key}`}
            key={category.key}
          >
            <h3 className="category-heading">{category.heading}</h3>
            <div className="product-grid">
              {category.products.map((product) => (
                <ProductCard key={product.name} product={product} onProduct={onProduct} />
              ))}
            </div>

            {category.showLoadMore && (
              <div className="load-more-wrap">
                <button
                  className="load-more-button"
                  type="button"
                  onClick={onShop}
                >
                  {`VIEW ALL ${category.heading.toUpperCase()}`}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
