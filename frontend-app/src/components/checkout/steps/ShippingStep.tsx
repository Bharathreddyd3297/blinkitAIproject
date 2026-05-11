import { motion } from 'framer-motion';
import { Building2, Home, MapPin, Phone, User } from 'lucide-react';

import { Input } from '@components/primitives/Input';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import {
  isAddressValid,
  selectSavedAddress,
  setAddress,
  type ShippingAddress,
} from '@store/slices/checkoutSlice';
import { mockAddresses } from '@utils/mock';
import { StepFooter, StepShell } from '@components/checkout/StepShell';
import { cn } from '@utils/cn';

interface ShippingStepProps {
  onBack: () => void;
  onNext: () => void;
}

/**
 * Saved-address picker on top + free-form address fields below. Selecting a
 * saved address pre-fills the form so the user can still tweak it. We
 * validate eagerly via `isAddressValid` from the slice; the Continue button
 * is disabled until the basics check out.
 */
export function ShippingStep({ onBack, onNext }: ShippingStepProps) {
  const dispatch = useAppDispatch();
  const address  = useAppSelector((s) => s.checkout.address);
  const selectedId = useAppSelector((s) => s.checkout.selectedAddressId);

  const update = (patch: Partial<ShippingAddress>) => dispatch(setAddress(patch));

  return (
    <StepShell
      eyebrow="Step 2 · Shipping"
      title="Where should we deliver?"
      description="Saved addresses load from the auth-service. You can always edit before continuing."
      footer={
        <StepFooter
          onBack={onBack}
          onNext={onNext}
          nextDisabled={!isAddressValid(address)}
        />
      }
    >
      {/* Saved addresses */}
      {mockAddresses.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-300">
            Saved addresses
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {mockAddresses.map((a) => {
              const active = selectedId === a.id;
              return (
                <motion.button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    dispatch(
                      selectSavedAddress({
                        id: a.id,
                        address: {
                          fullName: a.fullName,
                          phone:    a.phone,
                          street:   a.street,
                          landmark: a.landmark ?? '',
                          city:     a.city,
                          state:    a.state,
                          postalCode: a.postalCode,
                          country:  a.country,
                        },
                      }),
                    )
                  }
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'group relative rounded-2xl border bg-white/[0.02] p-4 text-left transition',
                    active
                      ? 'border-accent/60 shadow-glow-sm'
                      : 'border-white/10 hover:border-white/25',
                  )}
                >
                  <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.14em] text-ink-300">
                    {a.label === 'Home' ? <Home size={11} /> : <Building2 size={11} />}
                    {a.label}
                  </div>
                  <p className="mt-2 font-display text-sm font-semibold text-white">{a.fullName}</p>
                  <p className="mt-0.5 text-xs text-ink-200">{a.phone}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-ink-300">
                    {a.street}, {a.city}, {a.state} {a.postalCode}
                  </p>
                  {active && (
                    <motion.span
                      layoutId="saved-address-pin"
                      className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[0.65rem] font-bold text-white shadow-glow-sm"
                    >
                      ✓
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Form */}
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          name="fullName"
          label="Full name"
          placeholder="As on your ID"
          value={address.fullName}
          onChange={(e) => update({ fullName: e.target.value })}
          iconLeft={<User size={14} />}
          required
        />
        <Input
          name="phone"
          label="Phone"
          placeholder="+91 98765 43210"
          value={address.phone}
          onChange={(e) => update({ phone: e.target.value })}
          iconLeft={<Phone size={14} />}
          required
        />
        <div className="md:col-span-2">
          <Input
            name="street"
            label="Street address"
            placeholder="Building, floor, street"
            value={address.street}
            onChange={(e) => update({ street: e.target.value })}
            iconLeft={<MapPin size={14} />}
            required
          />
        </div>
        <div className="md:col-span-2">
          <Input
            name="landmark"
            label="Landmark (optional)"
            placeholder="Near…"
            value={address.landmark}
            onChange={(e) => update({ landmark: e.target.value })}
          />
        </div>
        <Input
          name="city"
          label="City"
          value={address.city}
          onChange={(e) => update({ city: e.target.value })}
          required
        />
        <Input
          name="state"
          label="State"
          value={address.state}
          onChange={(e) => update({ state: e.target.value })}
          required
        />
        <Input
          name="postalCode"
          label="Postal code"
          value={address.postalCode}
          onChange={(e) => update({ postalCode: e.target.value })}
          required
        />
        <Input
          name="country"
          label="Country"
          value={address.country}
          onChange={(e) => update({ country: e.target.value })}
          required
        />
      </div>
    </StepShell>
  );
}
