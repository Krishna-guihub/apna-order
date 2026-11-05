import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ChefHat,
  Clock3,
  IndianRupee,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  UtensilsCrossed,
} from 'lucide-react';
import {
  AdminLoading,
  AdminPanel,
  AdminSectionHeader,
  FilterSelect,
  Toggle,
} from './shared.jsx';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FoodImage,
  InlineAlert,
  Modal,
  Spinner,
  VegMark,
} from '../ui.jsx';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import {
  formatMoney,
  paiseToRupees,
  parseApiError,
  rupeesToPaise,
  classNames,
} from '../../utils/format.js';

const EMPTY_FORM = {
  name: '',
  description: '',
  category: '',
  price: '',
  isVeg: true,
  imageUrl: '',
  isAvailable: true,
  prepMinutes: '15',
};

function itemToForm(item) {
  return {
    name: item.name,
    description: item.description || '',
    category: item.category,
    price: paiseToRupees(item.pricePaise),
    isVeg: item.isVeg,
    imageUrl: item.imageUrl || '',
    isAvailable: item.isAvailable,
    prepMinutes: String(item.prepMinutes ?? 15),
  };
}

export default function AdminMenu() {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [availability, setAvailability] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);

  const loadMenu = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await api.get('/admin/menu');
      setItems(data.items);
      setError('');
    } catch (loadError) {
      setError(parseApiError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const categories = useMemo(
    () => ['All', ...new Set(items.map((item) => item.category))],
    [items],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (availability === 'available' && (!item.isAvailable || item.isArchived)) return false;
      if (availability === 'unavailable' && item.isAvailable) return false;
      if (availability === 'archived' && !item.isArchived) return false;
      if (availability === 'active' && item.isArchived) return false;
      if (term && !`${item.name} ${item.description} ${item.category}`.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [items, category, availability, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: categories[1] || '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm(itemToForm(item));
    setFormError('');
    setModalOpen(true);
  };

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    const pricePaise = rupeesToPaise(form.price);
    if (form.name.trim().length < 2) {
      setFormError('Give the dish a name of at least two characters.');
      return;
    }
    if (form.category.trim().length < 2) {
      setFormError('Add a category such as Starters, Mains or Drinks.');
      return;
    }
    if (!Number.isInteger(pricePaise) || pricePaise < 100) {
      setFormError('Enter a price of at least ₹1.00.');
      return;
    }
    const prepMinutes = Number(form.prepMinutes);
    if (!Number.isInteger(prepMinutes) || prepMinutes < 1 || prepMinutes > 180) {
      setFormError('Preparation time must be between 1 and 180 minutes.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      pricePaise,
      isVeg: Boolean(form.isVeg),
      imageUrl: form.imageUrl.trim(),
      isAvailable: Boolean(form.isAvailable),
      prepMinutes,
    };

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/menu/${editing.id}`, payload);
        addToast(`${payload.name} updated.`, 'success');
      } else {
        await api.post('/admin/menu', payload);
        addToast(`${payload.name} added to the menu.`, 'success');
      }
      setModalOpen(false);
      await loadMenu(true);
    } catch (saveError) {
      setFormError(parseApiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (item) => {
    setBusyId(item.id);
    try {
      const data = await api.patch(`/admin/menu/${item.id}`, { isAvailable: !item.isAvailable });
      setItems((current) => current.map((row) => (row.id === item.id ? data.item : row)));
      addToast(
        `${item.name} is now ${!item.isAvailable ? 'available' : 'unavailable'}.`,
        'info',
      );
    } catch (toggleError) {
      addToast(parseApiError(toggleError), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleArchive = async () => {
    if (!archiveTarget) return;
    const nextArchived = !archiveTarget.isArchived;
    setBusyId(archiveTarget.id);
    try {
      const data = await api.patch(`/admin/menu/${archiveTarget.id}`, { isArchived: nextArchived });
      setItems((current) => current.map((row) => (row.id === archiveTarget.id ? data.item : row)));
      addToast(
        nextArchived
          ? `${archiveTarget.name} archived and hidden from guests.`
          : `${archiveTarget.name} restored to the live menu.`,
        'info',
      );
      setArchiveTarget(null);
    } catch (archiveError) {
      addToast(parseApiError(archiveError), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const liveCount = items.filter((item) => !item.isArchived && item.isAvailable).length;
  const archivedCount = items.filter((item) => item.isArchived).length;

  return (
    <div className="admin-section">
      <AdminSectionHeader
        eyebrow="Menu studio"
        title="Dishes, prices and availability."
        description="Changes are applied immediately for every table. Prices are stored as integer paise on the server and recalculated on every order."
        busy={refreshing}
        onRefresh={() => loadMenu()}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} /> Add dish
          </button>
        }
      />

      <div className="admin-menu-summary">
        <span>
          <UtensilsCrossed size={16} /> {items.length} dishes on record
        </span>
        <span>
          <span className="status-dot status-dot-green" /> {liveCount} live and available
        </span>
        <span>
          <Archive size={15} /> {archivedCount} archived
        </span>
      </div>

      <div className="admin-toolbar">
        <div className="search-box admin-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dishes, categories or descriptions…"
            aria-label="Search menu items"
          />
        </div>
        <FilterSelect
          id="menu-category"
          label="Category"
          value={category}
          onChange={setCategory}
          options={categories.map((value) => ({ value, label: value }))}
        />
        <FilterSelect
          id="menu-availability"
          label="Availability"
          value={availability}
          onChange={setAvailability}
          options={[
            { value: 'all', label: 'All dishes' },
            { value: 'active', label: 'Live menu' },
            { value: 'available', label: 'Available now' },
            { value: 'unavailable', label: 'Unavailable' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
      </div>

      {error && (
        <ErrorState title="The menu could not load" message={error} onRetry={() => loadMenu()} />
      )}

      {loading ? (
        <AdminLoading label="Setting the menu…" rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No dishes match"
          message="Try a different search, category or availability filter."
          action={
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setSearch('');
                setCategory('All');
                setAvailability('all');
              }}
            >
              <SlidersHorizontal size={15} /> Reset filters
            </button>
          }
        />
      ) : (
        <div className="admin-menu-grid">
          {filtered.map((item) => (
            <article
              className={classNames(
                'admin-menu-card',
                item.isArchived && 'admin-menu-card-archived',
                !item.isAvailable && 'admin-menu-card-unavailable',
              )}
              key={item.id}
            >
              <div className="admin-menu-image">
                <FoodImage src={item.imageUrl} alt={item.name} />
                <div className="admin-menu-image-badges">
                  <VegMark isVeg={item.isVeg} />
                  {item.isArchived ? (
                    <Badge tone="neutral">Archived</Badge>
                  ) : item.isAvailable ? (
                    <Badge tone="green" dot>
                      Available
                    </Badge>
                  ) : (
                    <Badge tone="amber" dot>
                      Paused
                    </Badge>
                  )}
                </div>
                <span className="admin-menu-price">{formatMoney(item.pricePaise)}</span>
              </div>
              <div className="admin-menu-copy">
                <span className="admin-menu-category">{item.category}</span>
                <h3>{item.name}</h3>
                <p>{item.description || 'No description added yet.'}</p>
                <div className="admin-menu-meta">
                  <span>
                    <Clock3 size={14} /> {item.prepMinutes} min prep
                  </span>
                  <span>
                    <IndianRupee size={14} /> {formatMoney(item.pricePaise)} incl. tax at checkout
                  </span>
                </div>
                <div className="admin-menu-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => openEdit(item)}
                    disabled={item.isArchived}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  {!item.isArchived && (
                    <button
                      type="button"
                      className={classNames(
                        'btn btn-sm',
                        item.isAvailable ? 'btn-ghost' : 'btn-primary',
                      )}
                      onClick={() => toggleAvailability(item)}
                      disabled={busyId === item.id}
                    >
                      {busyId === item.id ? <Spinner size={14} /> : <ChefHat size={14} />}
                      {item.isAvailable ? 'Pause orders' : 'Make available'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button icon-button-sm"
                    onClick={() => setArchiveTarget(item)}
                    aria-label={item.isArchived ? `Restore ${item.name}` : `Archive ${item.name}`}
                    title={item.isArchived ? 'Restore dish' : 'Archive dish'}
                  >
                    {item.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <InlineAlert tone="info" title="Why paise?">
        <p>
          The API accepts integer paise only, so ₹249.50 becomes <code>24950</code>. This avoids
          floating-point rounding errors in bills and payments. Guests always see a server-calculated
          total.
        </p>
      </InlineAlert>

      <Modal
        open={modalOpen}
        onClose={saving ? undefined : () => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add a new dish'}
        eyebrow={editing ? 'Menu item' : 'New menu item'}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" form="admin-menu-form" className="btn btn-primary" disabled={saving}>
              {saving ? <Spinner size={16} /> : null}
              {editing ? 'Save changes' : 'Add to menu'}
            </button>
          </>
        }
      >
        <form id="admin-menu-form" className="admin-form" onSubmit={handleSubmit}>
          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}
          <div className="form-grid-two">
            <div className="field">
              <label htmlFor="menu-name">Dish name</label>
              <input
                id="menu-name"
                type="text"
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                maxLength={100}
                placeholder="e.g. Malabar Prawn Curry"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="menu-category-input">Category</label>
              <input
                id="menu-category-input"
                type="text"
                value={form.category}
                onChange={(event) => updateForm('category', event.target.value)}
                maxLength={60}
                placeholder="e.g. Mains"
                list="menu-category-options"
                required
              />
              <datalist id="menu-category-options">
                {categories
                  .filter((value) => value !== 'All')
                  .map((value) => (
                    <option value={value} key={value} />
                  ))}
              </datalist>
            </div>
          </div>

          <div className="field">
            <label htmlFor="menu-description">Description</label>
            <textarea
              id="menu-description"
              rows={3}
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              maxLength={500}
              placeholder="Ingredients, style of preparation, what makes it special…"
            />
            <small className="field-hint">{form.description.length}/500 characters</small>
          </div>

          <div className="form-grid-three">
            <div className="field">
              <label htmlFor="menu-price">Price (₹)</label>
              <input
                id="menu-price"
                type="number"
                min="1"
                max="100000"
                step="0.01"
                value={form.price}
                onChange={(event) => updateForm('price', event.target.value)}
                placeholder="249.00"
                required
              />
              <small className="field-hint">Stored as {rupeesToPaise(form.price)} paise</small>
            </div>
            <div className="field">
              <label htmlFor="menu-prep">Prep time (minutes)</label>
              <input
                id="menu-prep"
                type="number"
                min="1"
                max="180"
                step="1"
                value={form.prepMinutes}
                onChange={(event) => updateForm('prepMinutes', event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Dietary type</label>
              <div className="segmented-control">
                <button
                  type="button"
                  className={classNames('segment', form.isVeg && 'active')}
                  onClick={() => updateForm('isVeg', true)}
                >
                  <VegMark isVeg /> Vegetarian
                </button>
                <button
                  type="button"
                  className={classNames('segment', !form.isVeg && 'active')}
                  onClick={() => updateForm('isVeg', false)}
                >
                  <VegMark isVeg={false} /> Non-veg
                </button>
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="menu-image">Image URL</label>
            <input
              id="menu-image"
              type="url"
              value={form.imageUrl}
              onChange={(event) => updateForm('imageUrl', event.target.value)}
              maxLength={1000}
              placeholder="https://images.unsplash.com/… (optional)"
            />
            <small className="field-hint">
              Leave blank to show a branded fallback. Only remote https images are supported.
            </small>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.isAvailable}
              onChange={(event) => updateForm('isAvailable', event.target.checked)}
            />
            <span>
              <strong>Available to order now</strong>
              <small>Unavailable dishes remain on the menu but cannot be added to a cart.</small>
            </span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={toggleArchive}
        title={archiveTarget?.isArchived ? 'Restore this dish?' : 'Archive this dish?'}
        message={
          archiveTarget?.isArchived
            ? 'The dish returns to the admin menu as unavailable. Make it available when you are ready for guests to order it.'
            : 'Archived dishes disappear from every guest menu immediately. Existing orders are unaffected. You can restore it later.'
        }
        confirmLabel={archiveTarget?.isArchived ? 'Restore dish' : 'Archive dish'}
        danger={!archiveTarget?.isArchived}
        busy={busyId === archiveTarget?.id}
      />
    </div>
  );
}
