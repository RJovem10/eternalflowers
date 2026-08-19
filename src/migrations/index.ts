import * as migration_20260801_083313 from './20260801_083313';
import * as migration_20260801_103101_categories_localized from './20260801_103101_categories_localized';
import * as migration_20260802_072328_collections_localized from './20260802_072328_collections_localized';
import * as migration_20260802_082923_homepage_localized from './20260802_082923_homepage_localized';
import * as migration_20260803_123500_product_model from './20260803_123500_product_model';
import * as migration_20260803_181000_stock_reservations from './20260803_181000_stock_reservations';
import * as migration_20260808_000000_orders_model from './20260808_000000_orders_model';
import * as migration_20260808_000001_checkout_fields from './20260808_000001_checkout_fields';
import * as migration_20260808_000002_payment_fields from './20260808_000002_payment_fields';
import * as migration_20260808_000003_refund_fields from './20260808_000003_refund_fields';
import * as migration_20260809_000001_fulfillment_fields from './20260809_000001_fulfillment_fields';
import * as migration_20260809_000002_email_notifications from './20260809_000002_email_notifications';
import * as migration_20260818_000001_cancelled_at from './20260818_000001_cancelled_at';
import * as migration_20260818_000002_coupon_redeemed_at from './20260818_000002_coupon_redeemed_at';
import * as migration_20260819_180000_can_share_shipping_package from './20260819_180000_can_share_shipping_package';

export const migrations = [
  {
    up: migration_20260801_083313.up,
    down: migration_20260801_083313.down,
    name: '20260801_083313'
  },
  {
    up: migration_20260801_103101_categories_localized.up,
    down: migration_20260801_103101_categories_localized.down,
    name: '20260801_103101_categories_localized'
  },
  {
    up: migration_20260802_072328_collections_localized.up,
    down: migration_20260802_072328_collections_localized.down,
    name: '20260802_072328_collections_localized'
  },
  {
    up: migration_20260802_082923_homepage_localized.up,
    down: migration_20260802_082923_homepage_localized.down,
    name: '20260802_082923_homepage_localized'
  },
  {
    up: migration_20260803_123500_product_model.up,
    down: migration_20260803_123500_product_model.down,
    name: '20260803_123500_product_model'
  },
  {
    up: migration_20260803_181000_stock_reservations.up,
    down: migration_20260803_181000_stock_reservations.down,
    name: '20260803_181000_stock_reservations'
  },
  {
    up: migration_20260808_000000_orders_model.up,
    down: migration_20260808_000000_orders_model.down,
    name: '20260808_000000_orders_model'
  },
  {
    up: migration_20260808_000001_checkout_fields.up,
    down: migration_20260808_000001_checkout_fields.down,
    name: '20260808_000001_checkout_fields'
  },
  {
    up: migration_20260808_000002_payment_fields.up,
    down: migration_20260808_000002_payment_fields.down,
    name: '20260808_000002_payment_fields'
  },
  {
    up: migration_20260808_000003_refund_fields.up,
    down: migration_20260808_000003_refund_fields.down,
    name: '20260808_000003_refund_fields'
  },
  {
    up: migration_20260809_000001_fulfillment_fields.up,
    down: migration_20260809_000001_fulfillment_fields.down,
    name: '20260809_000001_fulfillment_fields'
  },
  {
    up: migration_20260809_000002_email_notifications.up,
    down: migration_20260809_000002_email_notifications.down,
    name: '20260809_000002_email_notifications'
  },
  {
    up: migration_20260818_000001_cancelled_at.up,
    down: migration_20260818_000001_cancelled_at.down,
    name: '20260818_000001_cancelled_at'
  },
  {
    up: migration_20260818_000002_coupon_redeemed_at.up,
    down: migration_20260818_000002_coupon_redeemed_at.down,
    name: '20260818_000002_coupon_redeemed_at'
  },
  {
    up: migration_20260819_180000_can_share_shipping_package.up,
    down: migration_20260819_180000_can_share_shipping_package.down,
    name: '20260819_180000_can_share_shipping_package'
  },
];