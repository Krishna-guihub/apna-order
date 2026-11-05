import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChefHat,
  Clock3,
  Filter,
  Leaf,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import SiteHeader from '../components/SiteHeader.jsx';
import CartPanel from '../components/CartPanel.jsx';
import {
  EmptyState,
  ErrorState,
  FoodImage,
  Skeleton,
  Spinner,
  VegMark,
} from '../components/ui.jsx';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  classNames,
  estimateCart,
  formatMoney,
  parseApiError,
} from '../utils/format.js';

const DIET_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'veg', label: 'Vegetarian' },
  { value: 'nonveg', label: 'Non-veg' },
];

export default function CustomerMenuPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [table, setTable] = useState(null);
  const [menu, setMenu] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [diet, setDiet] = useState('all');
  const [cart, setCart] = useState({});
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', notes: '' });

  const cartStorageKey = `apna-order-cart-${token}`;

  const loadPage = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [tableData, menuData] = await Promise.all([
        api.get(`/public/tables/${token}`),
        api.get(`/public/menu?tableToken=${encodeURIComponent(token)}`),
      ]);
      setTable(tableData.table);
      setMenu(menuData.menu);
      setMeta(menuData.meta);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setCartHydrated(false);
    try {
      const stored = window.localStorage.getItem(cartStorageKey);
      const parsed = stored ? JSON.parse(stored) : {};
      setCart(parsed && typeof parsed === 'object' ? parsed : {});
    } catch {
      setCart({});
    } finally {
      setCartHydrated(true);
    }
  }, [cartStorageKey]);

  useEffect(() => {
    if (!cartHydrated) return;
    window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartHydrated, cartStorageKey]);

  useEffect(() => {
    if (!form.customerName && window.localStorage.getItem('apna-order-customer-name')) {
      setForm((current) => ({
        ...current,
        customerName: window.localStorage.getItem('apna-order-customer-name') || '',
      }));
    }
  }, [form.customerName]);

  const menuItemsById = useMemo(() => {
    const map = new Map();
    menu?.items?.forEach((item) => map.set(item.id, item));
    return map;
  }, [menu]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => {
          const item = menuItemsById.get(Number(id));
          return item && quantity > 0 ? { ...item, quantity } : null;
        })
        .filter(Boolean),
    [cart, menuItemsById],
  );

  const totals = estimateCart(cartItems, meta?.taxRatePercent ?? 5);

  const filteredItems = useMemo(() => {
    if (!menu?.items) return [];
    const searchTerm = search.trim().toLowerCase();
    return menu.items.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (diet === 'veg' && !item.isVeg) return false;
      if (diet === 'nonveg' && item.isVeg) return false;
      if (
        searchTerm &&
        !`${item.name} ${item.description} ${item.category}`.toLowerCase().includes(searchTerm)
      ) {
        return false;
      }
      return true;
    });
  }, [menu, category, diet, search]);

  const updateQuantity = (id, delta) => {
    setCart((current) => {
      const next = { ...current };
      const value = Number(next[id] || 0) + delta;
      if (value <= 0) delete next[id];
      else next[id] = Math.min(value, 20);
      return next;
    });
  };

  const removeItem = (id) => {
    setCart((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;
    if (!form.customerName.trim()) {
      addToast('Please tell us your name before placing the order.', 'error');
      return;
    }
    setPlacing(true);
    try {
      const payload = {
        tableToken: token,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim() || undefined,
        notes: form.notes.trim() || undefined,
        items: cartItems.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
      };
      const result = await api.post('/public/orders', payload);
      window.localStorage.removeItem(cartStorageKey);
      window.localStorage.setItem('apna-order-customer-name', form.customerName.trim());
      setCart({});
      addToast('Order sent to the kitchen.', 'success');
      navigate(`/order/${result.order.publicId}?token=${encodeURIComponent(token)}`, {
        state: { justPlaced: true },
      });
    } catch (error) {
      addToast(parseApiError(error), 'error');
      if (error.status === 409) loadPage();
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="menu-page">
        <SiteHeader variant="cream" />
        <div className="shell menu-loading">
          <Skeleton className="skeleton-hero" />
          <div className="skeleton-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="skeleton-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    const invalidTable = loadError.status === 404;
    return (
      <div className="menu-page">
        <SiteHeader variant="cream" />
        <div className="shell invalid-token-wrap">
          <div className="invalid-token-card">
            <span className="invalid-icon">
              <QrCode size={34} />
            </span>
            <span className="eyebrow">{invalidTable ? 'QR not recognised' : 'Connection issue'}</span>
            <h1>{invalidTable ? 'This table link is not active.' : 'We could not open the menu.'}</h1>
            <p>
              {invalidTable
                ? 'Ask a member of staff for a fresh table QR code. For security, inactive or rotated QR tokens cannot open the menu.'
                : parseApiError(loadError)}
            </p>
            {invalidTable ? (
              <Link to="/" className="btn btn-primary">
                Back to home
              </Link>
            ) : (
              <button type="button" className="btn btn-primary" onClick={loadPage}>
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="menu-page">
      <SiteHeader variant="cream" />

      <header className="customer-bar">
        <div className="shell customer-bar-inner">
          <div className="customer-table-info">
            <span className="table-chip">
              <span className="pulse-dot" /> Table {table.tableNumber}
            </span>
            <span className="table-label">{table.label || 'Dining room'}</span>
          </div>
          <button
            type="button"
            className="cart-mobile-button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open cart with ${cartCount} items`}
          >
            <ShoppingBag size={18} />
            <span>Cart</span>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </header>

      <main className="shell menu-shell">
        <section className="menu-hero">
          <div className="menu-hero-copy">
            <span className="eyebrow">
              <Leaf size={14} /> Freshly made for your table
            </span>
            <h1>{table.restaurantName}</h1>
            <p>
              Seasonal ingredients, familiar comfort and a little theatre. Browse the menu, build your
              table order and we’ll take it from there.
            </p>
            <div className="menu-hero-meta">
              <span>
                <Clock3 size={15} /> Kitchen opens now
              </span>
              <span>
                <Sparkles size={15} /> Tax calculated at checkout
              </span>
              {meta?.simulatedPayments && <span className="dev-pill">Simulated payments</span>}
            </div>
          </div>
          <div className="menu-hero-art" aria-hidden="true">
            <div className="plate-art plate-art-back" />
            <div className="plate-art plate-art-front">
              <span className="art-leaf art-leaf-one" />
              <span className="art-leaf art-leaf-two" />
              <span className="art-dot art-dot-one" />
              <span className="art-dot art-dot-two" />
            </div>
            <span className="art-note">Made with care</span>
          </div>
        </section>

        <div className="menu-controls">
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search dishes, ingredients or a craving…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search the menu"
            />
            {search && (
              <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="diet-filter" aria-label="Dietary filter">
            <Filter size={15} aria-hidden="true" />
            {DIET_FILTERS.map((option) => (
              <button
                type="button"
                key={option.value}
                className={classNames('filter-chip', diet === option.value && 'active')}
                onClick={() => setDiet(option.value)}
                aria-pressed={diet === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <nav className="category-strip" aria-label="Menu categories">
          {['All', ...(menu.categories || [])].map((cat) => (
            <button
              key={cat}
              type="button"
              className={classNames('category-pill', category === cat && 'active')}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
            >
              {cat}
            </button>
          ))}
        </nav>

        <div className="menu-layout">
          <section className="menu-content" aria-label="Menu items">
            <div className="menu-results-head">
              <div>
                <span className="eyebrow">{category === 'All' ? 'The full menu' : category}</span>
                <h2>
                  {diet === 'veg' ? 'Vegetarian plates' : diet === 'nonveg' ? 'Non-veg plates' : 'What are you craving?'}
                </h2>
              </div>
              <span className="result-count">
                {filteredItems.length} {filteredItems.length === 1 ? 'dish' : 'dishes'}
              </span>
            </div>

            {filteredItems.length === 0 ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="No dishes match that search"
                message="Try a different category, clear the search, or switch the dietary filter."
                action={
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setSearch('');
                      setCategory('All');
                      setDiet('all');
                    }}
                  >
                    Reset filters
                  </button>
                }
              />
            ) : (
              <div className="food-grid">
                {filteredItems.map((item) => {
                  const quantity = Number(cart[item.id] || 0);
                  return (
                    <article
                      className={classNames('food-card', !item.isAvailable && 'food-card-unavailable')}
                      key={item.id}
                    >
                      <div className="food-card-image-wrap">
                        <FoodImage src={item.imageUrl} alt={item.name} />
                        <div className="food-card-top-badges">
                          <VegMark isVeg={item.isVeg} />
                          {!item.isAvailable && <span className="sold-out-badge">Unavailable</span>}
                        </div>
                        <span className="prep-badge">
                          <Clock3 size={13} /> {item.prepMinutes} min
                        </span>
                      </div>
                      <div className="food-card-body">
                        <span className="food-category">{item.category}</span>
                        <h3>{item.name}</h3>
                        <p>{item.description}</p>
                        <div className="food-card-footer">
                          <span className="food-price">{formatMoney(item.pricePaise)}</span>
                          {quantity > 0 ? (
                            <div className="qty-stepper" aria-label={`Quantity for ${item.name}`}>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, -1)}
                                aria-label={`Reduce ${item.name} quantity`}
                              >
                                <Minus size={15} />
                              </button>
                              <span aria-live="polite">{quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, 1)}
                                disabled={quantity >= 20}
                                aria-label={`Increase ${item.name} quantity`}
                              >
                                <Plus size={15} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="add-button"
                              onClick={() => updateQuantity(item.id, 1)}
                              disabled={!item.isAvailable}
                              aria-label={`Add ${item.name} to cart`}
                            >
                              <Plus size={15} /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="menu-footnote">
              <ChefHat size={18} />
              <p>
                <strong>Please tell us about allergies.</strong> Our kitchen handles nuts, dairy and
                gluten. Add a note with your order and our team will help.
              </p>
            </div>
          </section>

          <aside className="cart-desktop" aria-label="Cart">
            <CartPanel
              items={cartItems}
              totals={totals}
              taxRatePercent={meta?.taxRatePercent ?? 5}
              form={form}
              setForm={setForm}
              onPlaceOrder={handlePlaceOrder}
              onQuantityChange={updateQuantity}
              onRemove={removeItem}
              placing={placing}
            />
          </aside>
        </div>
      </main>

      {cartCount > 0 && (
        <div className="mobile-cart-bar">
          <button type="button" className="mobile-cart-summary" onClick={() => setCartOpen(true)}>
            <span className="mobile-cart-icon">
              <ShoppingBag size={18} />
              <span className="cart-badge">{cartCount}</span>
            </span>
            <span>
              <small>View your order</small>
              <strong>{formatMoney(totals.totalPaise)}</strong>
            </span>
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setCartOpen(true)}>
            Review cart <Plus size={16} />
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCartOpen(false)}>
          <div className="cart-drawer" role="dialog" aria-modal="true" aria-label="Your cart">
            <CartPanel
              items={cartItems}
              totals={totals}
              taxRatePercent={meta?.taxRatePercent ?? 5}
              form={form}
              setForm={setForm}
              onPlaceOrder={handlePlaceOrder}
              onQuantityChange={updateQuantity}
              onRemove={removeItem}
              placing={placing}
              onClose={() => setCartOpen(false)}
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
}
