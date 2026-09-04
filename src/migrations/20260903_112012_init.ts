import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_fulfillment_method" AS ENUM('shipping', 'pickup', 'delivery');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'active');
  CREATE TYPE "public"."enum_products_imported_from_price_tax_treatment" AS ENUM('inclusive', 'exclusive');
  CREATE TYPE "public"."enum_discount_codes_type" AS ENUM('percent', 'fixed');
  CREATE TYPE "public"."enum_import_jobs_status" AS ENUM('detecting', 'ready', 'importing', 'completed', 'failed', 'cancelled');
  CREATE TYPE "public"."enum_import_jobs_price_tax_treatment" AS ENUM('inclusive', 'exclusive');
  CREATE TYPE "public"."enum_gift_cards_status" AS ENUM('active', 'void');
  CREATE TYPE "public"."enum_gift_card_transactions_type" AS ENUM('issue', 'redeem', 'reverse');
  CREATE TYPE "public"."enum_campaigns_audience_mode" AS ENUM('all', 'tag', 'source');
  CREATE TYPE "public"."enum_campaigns_audience_source" AS ENUM('checkout', 'newsletter', 'import', 'manual');
  CREATE TYPE "public"."enum_campaigns_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed');
  CREATE TYPE "public"."enum_contacts_status" AS ENUM('subscribed', 'unsubscribed');
  CREATE TYPE "public"."enum_contacts_source" AS ENUM('checkout', 'newsletter', 'import', 'manual');
  CREATE TYPE "public"."enum_pages_blocks_hero_floating_cards_corner" AS ENUM('topLeft', 'topRight', 'bottomLeft', 'bottomRight');
  CREATE TYPE "public"."enum_pages_blocks_hero_variant" AS ENUM('centered', 'split', 'overlay', 'video', 'stacked', 'showcase');
  CREATE TYPE "public"."enum_pages_blocks_hero_scheme" AS ENUM('', 'default', 'muted', 'inverse', 'accent');
  CREATE TYPE "public"."enum_pages_blocks_hero_media_side" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_pages_blocks_hero_text_align" AS ENUM('left', 'center', 'right');
  CREATE TYPE "public"."enum_pages_blocks_hero_vertical_align" AS ENUM('top', 'middle', 'bottom');
  CREATE TYPE "public"."enum_pages_blocks_hero_overlay" AS ENUM('none', 'light', 'medium', 'dark');
  CREATE TYPE "public"."enum_pages_blocks_hero_min_height" AS ENUM('auto', 'md', 'lg', 'half', 'threeQuarter', 'screen');
  CREATE TYPE "public"."enum_pages_blocks_product_grid_variant" AS ENUM('grid', 'carousel', 'list');
  CREATE TYPE "public"."enum_pages_blocks_product_grid_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum_pages_blocks_product_grid_source" AS ENUM('latest', 'category', 'manual');
  CREATE TYPE "public"."enum_pages_blocks_image_gallery_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum_pages_blocks_split_hero_variant" AS ENUM('mediaLeft', 'mediaRight', 'overlay', 'stacked');
  CREATE TYPE "public"."enum_pages_blocks_split_hero_text_align" AS ENUM('left', 'center', 'right');
  CREATE TYPE "public"."enum_pages_blocks_split_hero_overlay_vertical_align" AS ENUM('top', 'middle', 'bottom');
  CREATE TYPE "public"."enum_pages_blocks_spacer_variant" AS ENUM('blank', 'line', 'dots', 'gradient');
  CREATE TYPE "public"."enum_pages_blocks_spacer_size" AS ENUM('sm', 'md', 'lg', 'xl');
  CREATE TYPE "public"."enum_pages_blocks_feature_grid_items_icon" AS ENUM('truck', 'leaf', 'clock', 'star', 'shield', 'heart');
  CREATE TYPE "public"."enum_pages_blocks_feature_grid_variant" AS ENUM('iconTop', 'iconLeft', 'cards', 'minimal');
  CREATE TYPE "public"."enum_pages_blocks_feature_grid_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum_pages_blocks_steps_variant" AS ENUM('horizontal', 'vertical', 'cards', 'compact');
  CREATE TYPE "public"."enum_pages_blocks_logo_strip_variant" AS ENUM('staticRow', 'grid', 'marquee', 'bordered');
  CREATE TYPE "public"."enum_pages_blocks_video_embed_variant" AS ENUM('contained', 'fullBleed', 'sideBySide', 'textOverlay');
  CREATE TYPE "public"."enum_pages_blocks_video_embed_provider" AS ENUM('youtube', 'vimeo');
  CREATE TYPE "public"."enum_pages_blocks_contact_variant" AS ENUM('mapSplit', 'mapStacked', 'detailsOnly', 'banner');
  CREATE TYPE "public"."enum_pages_blocks_featured_product_variant" AS ENUM('imageLeft', 'imageRight', 'overlay', 'stacked');
  CREATE TYPE "public"."enum_pages_blocks_incentives_items_icon" AS ENUM('truck', 'returns', 'lock', 'support', 'badge', 'gift');
  CREATE TYPE "public"."enum_pages_blocks_incentives_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum_pages_blocks_category_previews_variant" AS ENUM('grid', 'overlayCards', 'list');
  CREATE TYPE "public"."enum_pages_blocks_category_previews_source" AS ENUM('all', 'manual');
  CREATE TYPE "public"."enum_pages_blocks_promo_section_variant" AS ENUM('splitImage', 'overlay', 'bannerStrip');
  CREATE TYPE "public"."enum_pages_blocks_reviews_variant" AS ENUM('cards', 'list', 'masonry');
  CREATE TYPE "public"."enum_pages_blocks_media_hero_variant" AS ENUM('split', 'overlay');
  CREATE TYPE "public"."enum_pages_blocks_media_hero_text_align" AS ENUM('left', 'center', 'right');
  CREATE TYPE "public"."enum_pages_blocks_media_hero_vertical_align" AS ENUM('top', 'middle', 'bottom');
  CREATE TYPE "public"."enum_pages_blocks_media_hero_overlay" AS ENUM('none', 'light', 'medium', 'dark');
  CREATE TYPE "public"."enum_pages_blocks_media_hero_min_height" AS ENUM('md', 'lg', 'screen');
  CREATE TYPE "public"."enum_pages_blocks_ticker_variant" AS ENUM('static', 'marquee');
  CREATE TYPE "public"."enum_pages_blocks_story_stats_variant" AS ENUM('imageLeft', 'imageRight');
  CREATE TYPE "public"."enum_pages_blocks_custom_section_scheme" AS ENUM('', 'default', 'muted', 'inverse', 'accent');
  CREATE TYPE "public"."enum_pages_aeo_schema_type" AS ENUM('WebPage', 'Article');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_floating_cards_corner" AS ENUM('topLeft', 'topRight', 'bottomLeft', 'bottomRight');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_variant" AS ENUM('centered', 'split', 'overlay', 'video', 'stacked', 'showcase');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_scheme" AS ENUM('', 'default', 'muted', 'inverse', 'accent');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_media_side" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_text_align" AS ENUM('left', 'center', 'right');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_vertical_align" AS ENUM('top', 'middle', 'bottom');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_overlay" AS ENUM('none', 'light', 'medium', 'dark');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_min_height" AS ENUM('auto', 'md', 'lg', 'half', 'threeQuarter', 'screen');
  CREATE TYPE "public"."enum__pages_v_blocks_product_grid_variant" AS ENUM('grid', 'carousel', 'list');
  CREATE TYPE "public"."enum__pages_v_blocks_product_grid_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum__pages_v_blocks_product_grid_source" AS ENUM('latest', 'category', 'manual');
  CREATE TYPE "public"."enum__pages_v_blocks_image_gallery_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum__pages_v_blocks_split_hero_variant" AS ENUM('mediaLeft', 'mediaRight', 'overlay', 'stacked');
  CREATE TYPE "public"."enum__pages_v_blocks_split_hero_text_align" AS ENUM('left', 'center', 'right');
  CREATE TYPE "public"."enum__pages_v_blocks_split_hero_overlay_vertical_align" AS ENUM('top', 'middle', 'bottom');
  CREATE TYPE "public"."enum__pages_v_blocks_spacer_variant" AS ENUM('blank', 'line', 'dots', 'gradient');
  CREATE TYPE "public"."enum__pages_v_blocks_spacer_size" AS ENUM('sm', 'md', 'lg', 'xl');
  CREATE TYPE "public"."enum__pages_v_blocks_feature_grid_items_icon" AS ENUM('truck', 'leaf', 'clock', 'star', 'shield', 'heart');
  CREATE TYPE "public"."enum__pages_v_blocks_feature_grid_variant" AS ENUM('iconTop', 'iconLeft', 'cards', 'minimal');
  CREATE TYPE "public"."enum__pages_v_blocks_feature_grid_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum__pages_v_blocks_steps_variant" AS ENUM('horizontal', 'vertical', 'cards', 'compact');
  CREATE TYPE "public"."enum__pages_v_blocks_logo_strip_variant" AS ENUM('staticRow', 'grid', 'marquee', 'bordered');
  CREATE TYPE "public"."enum__pages_v_blocks_video_embed_variant" AS ENUM('contained', 'fullBleed', 'sideBySide', 'textOverlay');
  CREATE TYPE "public"."enum__pages_v_blocks_video_embed_provider" AS ENUM('youtube', 'vimeo');
  CREATE TYPE "public"."enum__pages_v_blocks_contact_variant" AS ENUM('mapSplit', 'mapStacked', 'detailsOnly', 'banner');
  CREATE TYPE "public"."enum__pages_v_blocks_featured_product_variant" AS ENUM('imageLeft', 'imageRight', 'overlay', 'stacked');
  CREATE TYPE "public"."enum__pages_v_blocks_incentives_items_icon" AS ENUM('truck', 'returns', 'lock', 'support', 'badge', 'gift');
  CREATE TYPE "public"."enum__pages_v_blocks_incentives_columns" AS ENUM('2', '3', '4');
  CREATE TYPE "public"."enum__pages_v_blocks_category_previews_variant" AS ENUM('grid', 'overlayCards', 'list');
  CREATE TYPE "public"."enum__pages_v_blocks_category_previews_source" AS ENUM('all', 'manual');
  CREATE TYPE "public"."enum__pages_v_blocks_promo_section_variant" AS ENUM('splitImage', 'overlay', 'bannerStrip');
  CREATE TYPE "public"."enum__pages_v_blocks_reviews_variant" AS ENUM('cards', 'list', 'masonry');
  CREATE TYPE "public"."enum__pages_v_blocks_media_hero_variant" AS ENUM('split', 'overlay');
  CREATE TYPE "public"."enum__pages_v_blocks_media_hero_text_align" AS ENUM('left', 'center', 'right');
  CREATE TYPE "public"."enum__pages_v_blocks_media_hero_vertical_align" AS ENUM('top', 'middle', 'bottom');
  CREATE TYPE "public"."enum__pages_v_blocks_media_hero_overlay" AS ENUM('none', 'light', 'medium', 'dark');
  CREATE TYPE "public"."enum__pages_v_blocks_media_hero_min_height" AS ENUM('md', 'lg', 'screen');
  CREATE TYPE "public"."enum__pages_v_blocks_ticker_variant" AS ENUM('static', 'marquee');
  CREATE TYPE "public"."enum__pages_v_blocks_story_stats_variant" AS ENUM('imageLeft', 'imageRight');
  CREATE TYPE "public"."enum__pages_v_blocks_custom_section_scheme" AS ENUM('', 'default', 'muted', 'inverse', 'accent');
  CREATE TYPE "public"."enum__pages_v_version_aeo_schema_type" AS ENUM('WebPage', 'Article');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_store_settings_currency" AS ENUM('AED', 'INR', 'USD', 'EUR', 'GBP');
  CREATE TYPE "public"."enum_store_settings_theme_heading_weight" AS ENUM('300', '400', '500', '600', '700');
  CREATE TYPE "public"."enum_store_settings_theme_body_weight" AS ENUM('300', '400', '500', '600', '700');
  CREATE TYPE "public"."enum_store_settings_theme_button_radius" AS ENUM('', 'none', 'sm', 'md', 'lg', 'full');
  CREATE TYPE "public"."enum_store_settings_header_layout" AS ENUM('theme', 'standard', 'centered', 'editorial');
  CREATE TYPE "public"."enum_store_settings_logo_size" AS ENUM('small', 'medium', 'large', 'xlarge');
  CREATE TYPE "public"."enum_section_definitions_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__section_definitions_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_users_roles" AS ENUM('super-admin');
  CREATE TYPE "public"."enum_import_items_warnings" AS ENUM('no_price', 'no_images', 'many_variants', 'currency_mismatch', 'boilerplate_description', 'variants_unavailable', 'duplicate_sku', 'inventory_unknown');
  CREATE TYPE "public"."enum_import_items_status" AS ENUM('pending', 'selected', 'skipped', 'imported', 'failed');
  CREATE TYPE "public"."enum_gateway_configs_environment" AS ENUM('test', 'live');
  CREATE TYPE "public"."enum_payment_attempts_status" AS ENUM('created', 'redirected', 'pending', 'authorized', 'succeeded', 'failed', 'cancelled', 'expired');
  CREATE TYPE "public"."enum_payment_gateway_requests_status" AS ENUM('new', 'reviewing', 'planned', 'declined');
  CREATE TABLE "orders_line_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"variant_title" varchar,
  	"unit_price" numeric NOT NULL,
  	"qty" numeric NOT NULL,
  	"line_total" numeric NOT NULL,
  	"is_gift_card" boolean DEFAULT false
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_number" varchar,
  	"customer_id" integer,
  	"email" varchar NOT NULL,
  	"subtotal" numeric NOT NULL,
  	"discount_amount" numeric NOT NULL,
  	"shipping_amount" numeric NOT NULL,
  	"tax_amount" numeric NOT NULL,
  	"tax_rate" numeric,
  	"tax_inclusive" boolean,
  	"supplier_trn" varchar,
  	"total" numeric NOT NULL,
  	"gift_card_amount" numeric,
  	"gift_card_used_id" integer,
  	"gift_card_recipient_name" varchar,
  	"gift_card_recipient_email" varchar,
  	"gift_card_message" varchar,
  	"refunded_amount" numeric DEFAULT 0,
  	"discount_code" varchar,
  	"currency" varchar NOT NULL,
  	"shipping_address_name" varchar NOT NULL,
  	"shipping_address_line1" varchar NOT NULL,
  	"shipping_address_line2" varchar,
  	"shipping_address_city" varchar NOT NULL,
  	"shipping_address_state" varchar,
  	"shipping_address_postal_code" varchar NOT NULL,
  	"shipping_address_country" varchar NOT NULL,
  	"shipping_address_phone" varchar,
  	"fulfillment_method" "enum_orders_fulfillment_method",
  	"fulfillment_date" timestamp(3) with time zone,
  	"fulfillment_window_label" varchar,
  	"fulfillment_zone_name" varchar,
  	"status" "enum_orders_status" DEFAULT 'pending' NOT NULL,
  	"payment_provider" varchar,
  	"provider_ref" varchar,
  	"provider_event_id" varchar,
  	"paid_at" timestamp(3) with time zone,
  	"authorized_at" timestamp(3) with time zone,
  	"payment_attempt_id" integer,
  	"tracking_number" varchar,
  	"invoice_number" varchar,
  	"invoice_issued_at" timestamp(3) with time zone,
  	"invoice_sent_at" timestamp(3) with time zone,
  	"invoice_pdf_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"invoice_number" varchar,
  	"prefix" varchar DEFAULT '',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "products_options_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "products_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "products_variants_option_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"option" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "products_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"price" numeric NOT NULL,
  	"sku" varchar,
  	"stock" numeric DEFAULT 0 NOT NULL
  );
  
  CREATE TABLE "products_specifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" jsonb,
  	"category_id" integer,
  	"is_sample_content" boolean DEFAULT false,
  	"issues_gift_card" boolean DEFAULT false,
  	"slug" varchar NOT NULL,
  	"status" "enum_products_status" DEFAULT 'draft' NOT NULL,
  	"price" numeric NOT NULL,
  	"stock" numeric DEFAULT 0 NOT NULL,
  	"imported_from_source_id" varchar,
  	"imported_from_source_origin" varchar,
  	"imported_from_external_id" varchar,
  	"imported_from_imported_at" timestamp(3) with time zone,
  	"imported_from_price_tax_treatment" "enum_products_imported_from_price_tax_treatment",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"image_id" integer,
  	"is_sample_content" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "discount_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"type" "enum_discount_codes_type" NOT NULL,
  	"value" numeric NOT NULL,
  	"min_order" numeric,
  	"usage_limit" numeric,
  	"used_count" numeric DEFAULT 0 NOT NULL,
  	"valid_from" timestamp(3) with time zone,
  	"valid_until" timestamp(3) with time zone,
  	"active" boolean DEFAULT true NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "import_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source_url" varchar NOT NULL,
  	"source_id" varchar,
  	"status" "enum_import_jobs_status" DEFAULT 'detecting' NOT NULL,
  	"detected_product_count" numeric DEFAULT 0,
  	"selected_count" numeric DEFAULT 0,
  	"imported_count" numeric DEFAULT 0,
  	"failed_count" numeric DEFAULT 0,
  	"source_currency" varchar,
  	"price_tax_treatment" "enum_import_jobs_price_tax_treatment",
  	"ownership_attested_at" timestamp(3) with time zone,
  	"ownership_attested_by_id" integer,
  	"error" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gift_cards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"last4" varchar NOT NULL,
  	"initial_amount" numeric NOT NULL,
  	"balance" numeric NOT NULL,
  	"currency" varchar NOT NULL,
  	"status" "enum_gift_cards_status" DEFAULT 'active' NOT NULL,
  	"issued_from_order_id" integer,
  	"recipient_name" varchar,
  	"recipient_email" varchar,
  	"message" varchar,
  	"issued_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gift_card_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"gift_card_id" integer NOT NULL,
  	"type" "enum_gift_card_transactions_type" NOT NULL,
  	"amount" numeric NOT NULL,
  	"order_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customers_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"line1" varchar NOT NULL,
  	"line2" varchar,
  	"city" varchar NOT NULL,
  	"state" varchar,
  	"postal_code" varchar NOT NULL,
  	"country" varchar NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"password_hash" varchar,
  	"magic_link_nonce" varchar,
  	"last_login_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "campaigns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"subject" varchar NOT NULL,
  	"body" jsonb,
  	"audience_mode" "enum_campaigns_audience_mode" DEFAULT 'all',
  	"audience_tag" varchar,
  	"audience_source" "enum_campaigns_audience_source",
  	"status" "enum_campaigns_status" DEFAULT 'draft',
  	"scheduled_at" timestamp(3) with time zone,
  	"total_recipients" numeric DEFAULT 0,
  	"sent_count" numeric DEFAULT 0,
  	"failed_count" numeric DEFAULT 0,
  	"send_cursor" numeric DEFAULT 0,
  	"send_attempts" numeric DEFAULT 0,
  	"started_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "contacts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"status" "enum_contacts_status" DEFAULT 'subscribed',
  	"source" "enum_contacts_source" DEFAULT 'manual',
  	"unsubscribed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "contacts_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "marketing_configs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"resend_api_key" varchar,
  	"from_name" varchar,
  	"from_email" varchar NOT NULL,
  	"active" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero_floating_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"corner" "enum_pages_blocks_hero_floating_cards_corner" DEFAULT 'topRight'
  );
  
  CREATE TABLE "pages_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_hero_variant" DEFAULT 'centered',
  	"scheme" "enum_pages_blocks_hero_scheme",
  	"eyebrow" varchar,
  	"heading" varchar,
  	"heading_accent" varchar,
  	"subheading" varchar,
  	"feature_chip" varchar,
  	"media_id" integer,
  	"poster_id" integer,
  	"media_side" "enum_pages_blocks_hero_media_side" DEFAULT 'right',
  	"text_align" "enum_pages_blocks_hero_text_align" DEFAULT 'center',
  	"vertical_align" "enum_pages_blocks_hero_vertical_align" DEFAULT 'middle',
  	"overlay" "enum_pages_blocks_hero_overlay" DEFAULT 'medium',
  	"min_height" "enum_pages_blocks_hero_min_height" DEFAULT 'auto',
  	"primary_cta_label" varchar,
  	"primary_cta_href" varchar,
  	"secondary_cta_label" varchar,
  	"secondary_cta_href" varchar,
  	"background_image_id" integer,
  	"cta_label" varchar,
  	"cta_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_product_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_product_grid_variant" DEFAULT 'grid',
  	"columns" "enum_pages_blocks_product_grid_columns" DEFAULT '4',
  	"eyebrow" varchar,
  	"heading" varchar,
  	"source" "enum_pages_blocks_product_grid_source" DEFAULT 'latest',
  	"category_id" integer,
  	"limit" numeric DEFAULT 8,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_image_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"columns" "enum_pages_blocks_image_gallery_columns" DEFAULT '3',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_cta_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"button_label" varchar,
  	"button_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_testimonials_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"quote" varchar,
  	"author" varchar,
  	"role" varchar
  );
  
  CREATE TABLE "pages_blocks_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "pages_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_newsletter_signup" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"placeholder" varchar DEFAULT 'Enter your email address',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_split_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_split_hero_variant" DEFAULT 'mediaLeft',
  	"text_align" "enum_pages_blocks_split_hero_text_align" DEFAULT 'center',
  	"overlay_vertical_align" "enum_pages_blocks_split_hero_overlay_vertical_align" DEFAULT 'middle',
  	"eyebrow" varchar,
  	"heading" varchar,
  	"subheading" varchar,
  	"media_id" integer,
  	"primary_cta_label" varchar,
  	"primary_cta_href" varchar,
  	"secondary_cta_label" varchar,
  	"secondary_cta_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_spacer" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_spacer_variant" DEFAULT 'blank',
  	"size" "enum_pages_blocks_spacer_size" DEFAULT 'md',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_feature_grid_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "enum_pages_blocks_feature_grid_items_icon" DEFAULT 'star',
  	"heading" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "pages_blocks_feature_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_feature_grid_variant" DEFAULT 'iconTop',
  	"heading" varchar,
  	"columns" "enum_pages_blocks_feature_grid_columns" DEFAULT '3',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_steps_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "pages_blocks_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_steps_variant" DEFAULT 'horizontal',
  	"heading" varchar,
  	"numbered" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_logo_strip_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"label" varchar,
  	"href" varchar
  );
  
  CREATE TABLE "pages_blocks_logo_strip" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_logo_strip_variant" DEFAULT 'staticRow',
  	"heading" varchar,
  	"grayscale" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_video_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_video_embed_variant" DEFAULT 'contained',
  	"heading" varchar,
  	"provider" "enum_pages_blocks_video_embed_provider" DEFAULT 'youtube',
  	"url" varchar,
  	"poster_id" integer,
  	"caption" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_contact_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "pages_blocks_contact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_contact_variant" DEFAULT 'mapSplit',
  	"heading" varchar,
  	"address" varchar,
  	"phone" varchar,
  	"whatsapp" varchar,
  	"email" varchar,
  	"map_embed_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_featured_product" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_featured_product_variant" DEFAULT 'imageLeft',
  	"product_id" integer,
  	"heading_override" varchar,
  	"cta_label" varchar DEFAULT 'View',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_incentives_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "enum_pages_blocks_incentives_items_icon" DEFAULT 'truck',
  	"heading" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "pages_blocks_incentives" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"columns" "enum_pages_blocks_incentives_columns" DEFAULT '4',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_category_previews" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_category_previews_variant" DEFAULT 'grid',
  	"heading" varchar,
  	"source" "enum_pages_blocks_category_previews_source" DEFAULT 'all',
  	"limit" numeric DEFAULT 6,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_promo_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_promo_section_variant" DEFAULT 'splitImage',
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"media_id" integer,
  	"primary_cta_label" varchar,
  	"primary_cta_href" varchar,
  	"secondary_cta_label" varchar,
  	"secondary_cta_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_reviews_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"rating" numeric DEFAULT 5,
  	"quote" varchar,
  	"author" varchar,
  	"role" varchar,
  	"product_id" integer
  );
  
  CREATE TABLE "pages_blocks_reviews" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_reviews_variant" DEFAULT 'cards',
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_media_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_media_hero_variant" DEFAULT 'split',
  	"media_id" integer,
  	"poster_id" integer,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"subheading" varchar,
  	"text_align" "enum_pages_blocks_media_hero_text_align" DEFAULT 'center',
  	"vertical_align" "enum_pages_blocks_media_hero_vertical_align" DEFAULT 'middle',
  	"overlay" "enum_pages_blocks_media_hero_overlay" DEFAULT 'medium',
  	"min_height" "enum_pages_blocks_media_hero_min_height" DEFAULT 'lg',
  	"primary_cta_label" varchar,
  	"primary_cta_href" varchar,
  	"secondary_cta_label" varchar,
  	"secondary_cta_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_ticker_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "pages_blocks_ticker" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_ticker_variant" DEFAULT 'static',
  	"separator" varchar DEFAULT '·',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_story_stats_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "pages_blocks_story_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant" "enum_pages_blocks_story_stats_variant" DEFAULT 'imageRight',
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_custom_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"definition_id" integer,
  	"scheme" "enum_pages_blocks_custom_section_scheme",
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"meta_canonical_url" varchar,
  	"noindex" boolean DEFAULT false,
  	"aeo_answer_summary" varchar,
  	"aeo_schema_type" "enum_pages_aeo_schema_type" DEFAULT 'WebPage',
  	"is_sample_content" boolean DEFAULT false,
  	"block_styles" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"media_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "_pages_v_blocks_hero_floating_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"corner" "enum__pages_v_blocks_hero_floating_cards_corner" DEFAULT 'topRight',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_hero_variant" DEFAULT 'centered',
  	"scheme" "enum__pages_v_blocks_hero_scheme",
  	"eyebrow" varchar,
  	"heading" varchar,
  	"heading_accent" varchar,
  	"subheading" varchar,
  	"feature_chip" varchar,
  	"media_id" integer,
  	"poster_id" integer,
  	"media_side" "enum__pages_v_blocks_hero_media_side" DEFAULT 'right',
  	"text_align" "enum__pages_v_blocks_hero_text_align" DEFAULT 'center',
  	"vertical_align" "enum__pages_v_blocks_hero_vertical_align" DEFAULT 'middle',
  	"overlay" "enum__pages_v_blocks_hero_overlay" DEFAULT 'medium',
  	"min_height" "enum__pages_v_blocks_hero_min_height" DEFAULT 'auto',
  	"primary_cta_label" varchar,
  	"primary_cta_href" varchar,
  	"secondary_cta_label" varchar,
  	"secondary_cta_href" varchar,
  	"background_image_id" integer,
  	"cta_label" varchar,
  	"cta_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_product_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_product_grid_variant" DEFAULT 'grid',
  	"columns" "enum__pages_v_blocks_product_grid_columns" DEFAULT '4',
  	"eyebrow" varchar,
  	"heading" varchar,
  	"source" "enum__pages_v_blocks_product_grid_source" DEFAULT 'latest',
  	"category_id" integer,
  	"limit" numeric DEFAULT 8,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_image_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"columns" "enum__pages_v_blocks_image_gallery_columns" DEFAULT '3',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_cta_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"button_label" varchar,
  	"button_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_testimonials_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"quote" varchar,
  	"author" varchar,
  	"role" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_newsletter_signup" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"placeholder" varchar DEFAULT 'Enter your email address',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_split_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_split_hero_variant" DEFAULT 'mediaLeft',
  	"text_align" "enum__pages_v_blocks_split_hero_text_align" DEFAULT 'center',
  	"overlay_vertical_align" "enum__pages_v_blocks_split_hero_overlay_vertical_align" DEFAULT 'middle',
  	"eyebrow" varchar,
  	"heading" varchar,
  	"subheading" varchar,
  	"media_id" integer,
  	"primary_cta_label" varchar,
  	"primary_cta_href" varchar,
  	"secondary_cta_label" varchar,
  	"secondary_cta_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_spacer" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_spacer_variant" DEFAULT 'blank',
  	"size" "enum__pages_v_blocks_spacer_size" DEFAULT 'md',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_feature_grid_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"icon" "enum__pages_v_blocks_feature_grid_items_icon" DEFAULT 'star',
  	"heading" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_feature_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_feature_grid_variant" DEFAULT 'iconTop',
  	"heading" varchar,
  	"columns" "enum__pages_v_blocks_feature_grid_columns" DEFAULT '3',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_steps_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_steps_variant" DEFAULT 'horizontal',
  	"heading" varchar,
  	"numbered" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_logo_strip_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"label" varchar,
  	"href" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_logo_strip" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_logo_strip_variant" DEFAULT 'staticRow',
  	"heading" varchar,
  	"grayscale" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_video_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_video_embed_variant" DEFAULT 'contained',
  	"heading" varchar,
  	"provider" "enum__pages_v_blocks_video_embed_provider" DEFAULT 'youtube',
  	"url" varchar,
  	"poster_id" integer,
  	"caption" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_contact_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_contact" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_contact_variant" DEFAULT 'mapSplit',
  	"heading" varchar,
  	"address" varchar,
  	"phone" varchar,
  	"whatsapp" varchar,
  	"email" varchar,
  	"map_embed_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_featured_product" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_featured_product_variant" DEFAULT 'imageLeft',
  	"product_id" integer,
  	"heading_override" varchar,
  	"cta_label" varchar DEFAULT 'View',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_incentives_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"icon" "enum__pages_v_blocks_incentives_items_icon" DEFAULT 'truck',
  	"heading" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_incentives" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"columns" "enum__pages_v_blocks_incentives_columns" DEFAULT '4',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_category_previews" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_category_previews_variant" DEFAULT 'grid',
  	"heading" varchar,
  	"source" "enum__pages_v_blocks_category_previews_source" DEFAULT 'all',
  	"limit" numeric DEFAULT 6,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_promo_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_promo_section_variant" DEFAULT 'splitImage',
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"media_id" integer,
  	"primary_cta_label" varchar,
  	"primary_cta_href" varchar,
  	"secondary_cta_label" varchar,
  	"secondary_cta_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_reviews_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"rating" numeric DEFAULT 5,
  	"quote" varchar,
  	"author" varchar,
  	"role" varchar,
  	"product_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_reviews" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_reviews_variant" DEFAULT 'cards',
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_media_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_media_hero_variant" DEFAULT 'split',
  	"media_id" integer,
  	"poster_id" integer,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"subheading" varchar,
  	"text_align" "enum__pages_v_blocks_media_hero_text_align" DEFAULT 'center',
  	"vertical_align" "enum__pages_v_blocks_media_hero_vertical_align" DEFAULT 'middle',
  	"overlay" "enum__pages_v_blocks_media_hero_overlay" DEFAULT 'medium',
  	"min_height" "enum__pages_v_blocks_media_hero_min_height" DEFAULT 'lg',
  	"primary_cta_label" varchar,
  	"primary_cta_href" varchar,
  	"secondary_cta_label" varchar,
  	"secondary_cta_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_ticker_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_ticker" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_ticker_variant" DEFAULT 'static',
  	"separator" varchar DEFAULT '·',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_story_stats_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_story_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant" "enum__pages_v_blocks_story_stats_variant" DEFAULT 'imageRight',
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_custom_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"definition_id" integer,
  	"scheme" "enum__pages_v_blocks_custom_section_scheme",
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_canonical_url" varchar,
  	"version_noindex" boolean DEFAULT false,
  	"version_aeo_answer_summary" varchar,
  	"version_aeo_schema_type" "enum__pages_v_version_aeo_schema_type" DEFAULT 'WebPage',
  	"version_is_sample_content" boolean DEFAULT false,
  	"version_block_styles" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_pages_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"media_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"content_hash" varchar,
  	"alt" varchar NOT NULL,
  	"is_sample_content" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar
  );
  
  CREATE TABLE "store_settings_nav_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "store_settings_fulfillment_pickup_windows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"start" varchar NOT NULL,
  	"end" varchar NOT NULL
  );
  
  CREATE TABLE "store_settings_fulfillment_delivery_zones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"areas_note" varchar,
  	"fee" numeric NOT NULL
  );
  
  CREATE TABLE "store_settings_fulfillment_delivery_windows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"start" varchar NOT NULL,
  	"end" varchar NOT NULL
  );
  
  CREATE TABLE "store_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_name" varchar NOT NULL,
  	"currency" "enum_store_settings_currency" DEFAULT 'AED' NOT NULL,
  	"logo_id" integer,
  	"description" varchar,
  	"theme_primary_color" varchar,
  	"theme_accent_color" varchar,
  	"theme_background_color" varchar,
  	"theme_text_color" varchar,
  	"theme_font_family" varchar,
  	"theme_font_family_axes" jsonb,
  	"theme_heading_font" varchar,
  	"theme_heading_font_axes" jsonb,
  	"theme_display_font" varchar,
  	"theme_display_font_axes" jsonb,
  	"theme_heading_weight" "enum_store_settings_theme_heading_weight",
  	"theme_body_weight" "enum_store_settings_theme_body_weight",
  	"theme_button_radius" "enum_store_settings_theme_button_radius",
  	"theme_customizations" jsonb,
  	"block_style_defaults" jsonb,
  	"custom_css" varchar,
  	"custom_css_enabled" boolean DEFAULT true,
  	"announcement" varchar,
  	"header_layout" "enum_store_settings_header_layout" DEFAULT 'theme',
  	"logo_size" "enum_store_settings_logo_size" DEFAULT 'medium',
  	"fulfillment_enabled" boolean DEFAULT false,
  	"fulfillment_timezone" varchar DEFAULT 'Asia/Dubai',
  	"fulfillment_cutoff_time" varchar DEFAULT '21:00',
  	"fulfillment_max_days_ahead" numeric DEFAULT 7,
  	"fulfillment_pickup_enabled" boolean DEFAULT true,
  	"fulfillment_pickup_location_label" varchar,
  	"fulfillment_delivery_enabled" boolean DEFAULT false,
  	"tax_enabled" boolean DEFAULT false,
  	"tax_registration_number" varchar,
  	"tax_rate" numeric DEFAULT 5,
  	"tax_prices_include_tax" boolean DEFAULT true,
  	"next_invoice_number" numeric DEFAULT 1,
  	"analytics_ga4_measurement_id" varchar,
  	"analytics_gtm_container_id" varchar,
  	"analytics_meta_pixel_id" varchar,
  	"analytics_tiktok_pixel_id" varchar,
  	"analytics_pinterest_tag_id" varchar,
  	"analytics_snapchat_pixel_id" varchar,
  	"analytics_google_ads_id" varchar,
  	"analytics_clarity_project_id" varchar,
  	"analytics_hotjar_id" varchar,
  	"storefront_theme" varchar DEFAULT 'default',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "section_definitions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"recipe" jsonb,
  	"preset_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_section_definitions_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_section_definitions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_recipe" jsonb,
  	"version_preset_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__section_definitions_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "import_items_warnings" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_import_items_warnings",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "import_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"job_id" integer NOT NULL,
  	"external_id" varchar NOT NULL,
  	"mapped" jsonb,
  	"status" "enum_import_items_status" DEFAULT 'pending' NOT NULL,
  	"claimed_at" timestamp(3) with time zone,
  	"error" varchar,
  	"product_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gateway_configs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider" varchar NOT NULL,
  	"enabled" boolean DEFAULT false,
  	"environment" "enum_gateway_configs_environment" DEFAULT 'test',
  	"encrypted_credentials" varchar,
  	"configuration_version" numeric DEFAULT 1,
  	"publishable_key" varchar,
  	"secret_key" varchar,
  	"webhook_secret" varchar,
  	"active" boolean DEFAULT false,
  	"webhook_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payment_attempts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" integer NOT NULL,
  	"provider" varchar NOT NULL,
  	"provider_session_id" varchar,
  	"idempotency_key" varchar NOT NULL,
  	"status" "enum_payment_attempts_status" DEFAULT 'created' NOT NULL,
  	"amount" numeric,
  	"currency" varchar,
  	"provider_payment_id" varchar,
  	"failure_code" varchar,
  	"failure_message" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "processed_webhook_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider" varchar NOT NULL,
  	"provider_event_id" varchar NOT NULL,
  	"payment_attempt_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payment_gateway_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider_name" varchar NOT NULL,
  	"note" varchar,
  	"requested_by_email" varchar,
  	"status" "enum_payment_gateway_requests_status" DEFAULT 'new',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_mcp_api_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"label" varchar,
  	"description" varchar,
  	"products_find" boolean DEFAULT false,
  	"products_create" boolean DEFAULT false,
  	"products_update" boolean DEFAULT false,
  	"categories_find" boolean DEFAULT false,
  	"categories_create" boolean DEFAULT false,
  	"categories_update" boolean DEFAULT false,
  	"orders_find" boolean DEFAULT false,
  	"pages_find" boolean DEFAULT false,
  	"pages_create" boolean DEFAULT false,
  	"pages_update" boolean DEFAULT false,
  	"payload_mcp_tool_list_blocks" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"orders_id" integer,
  	"invoices_id" integer,
  	"products_id" integer,
  	"categories_id" integer,
  	"discount_codes_id" integer,
  	"import_jobs_id" integer,
  	"gift_cards_id" integer,
  	"gift_card_transactions_id" integer,
  	"customers_id" integer,
  	"campaigns_id" integer,
  	"contacts_id" integer,
  	"marketing_configs_id" integer,
  	"pages_id" integer,
  	"media_id" integer,
  	"store_settings_id" integer,
  	"section_definitions_id" integer,
  	"users_id" integer,
  	"import_items_id" integer,
  	"gateway_configs_id" integer,
  	"payment_attempts_id" integer,
  	"processed_webhook_events_id" integer,
  	"payment_gateway_requests_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "orders_line_items" ADD CONSTRAINT "orders_line_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_gift_card_used_id_gift_cards_id_fk" FOREIGN KEY ("gift_card_used_id") REFERENCES "public"."gift_cards"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_pdf_id_invoices_id_fk" FOREIGN KEY ("invoice_pdf_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_options_values" ADD CONSTRAINT "products_options_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_options" ADD CONSTRAINT "products_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_variants_option_values" ADD CONSTRAINT "products_variants_option_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_specifications" ADD CONSTRAINT "products_specifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_ownership_attested_by_id_users_id_fk" FOREIGN KEY ("ownership_attested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_issued_from_order_id_orders_id_fk" FOREIGN KEY ("issued_from_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_gift_card_id_gift_cards_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers_addresses" ADD CONSTRAINT "customers_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contacts_texts" ADD CONSTRAINT "contacts_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_floating_cards" ADD CONSTRAINT "pages_blocks_hero_floating_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_rich_text" ADD CONSTRAINT "pages_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_product_grid" ADD CONSTRAINT "pages_blocks_product_grid_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_product_grid" ADD CONSTRAINT "pages_blocks_product_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery" ADD CONSTRAINT "pages_blocks_image_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta_banner" ADD CONSTRAINT "pages_blocks_cta_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonials_items" ADD CONSTRAINT "pages_blocks_testimonials_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonials" ADD CONSTRAINT "pages_blocks_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_items" ADD CONSTRAINT "pages_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq" ADD CONSTRAINT "pages_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_newsletter_signup" ADD CONSTRAINT "pages_blocks_newsletter_signup_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_split_hero" ADD CONSTRAINT "pages_blocks_split_hero_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_split_hero" ADD CONSTRAINT "pages_blocks_split_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_spacer" ADD CONSTRAINT "pages_blocks_spacer_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid_items" ADD CONSTRAINT "pages_blocks_feature_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid" ADD CONSTRAINT "pages_blocks_feature_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_steps_steps" ADD CONSTRAINT "pages_blocks_steps_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_steps" ADD CONSTRAINT "pages_blocks_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_logo_strip_logos" ADD CONSTRAINT "pages_blocks_logo_strip_logos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_logo_strip_logos" ADD CONSTRAINT "pages_blocks_logo_strip_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_logo_strip"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_logo_strip" ADD CONSTRAINT "pages_blocks_logo_strip_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_video_embed" ADD CONSTRAINT "pages_blocks_video_embed_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_video_embed" ADD CONSTRAINT "pages_blocks_video_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact_hours" ADD CONSTRAINT "pages_blocks_contact_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_contact"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_contact" ADD CONSTRAINT "pages_blocks_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_featured_product" ADD CONSTRAINT "pages_blocks_featured_product_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_featured_product" ADD CONSTRAINT "pages_blocks_featured_product_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_incentives_items" ADD CONSTRAINT "pages_blocks_incentives_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_incentives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_incentives" ADD CONSTRAINT "pages_blocks_incentives_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_category_previews" ADD CONSTRAINT "pages_blocks_category_previews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_promo_section" ADD CONSTRAINT "pages_blocks_promo_section_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_promo_section" ADD CONSTRAINT "pages_blocks_promo_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_reviews_items" ADD CONSTRAINT "pages_blocks_reviews_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_reviews_items" ADD CONSTRAINT "pages_blocks_reviews_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_reviews" ADD CONSTRAINT "pages_blocks_reviews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_hero" ADD CONSTRAINT "pages_blocks_media_hero_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_hero" ADD CONSTRAINT "pages_blocks_media_hero_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_hero" ADD CONSTRAINT "pages_blocks_media_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_ticker_items" ADD CONSTRAINT "pages_blocks_ticker_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_ticker"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_ticker" ADD CONSTRAINT "pages_blocks_ticker_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_story_stats_stats" ADD CONSTRAINT "pages_blocks_story_stats_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_story_stats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_story_stats" ADD CONSTRAINT "pages_blocks_story_stats_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_story_stats" ADD CONSTRAINT "pages_blocks_story_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_custom_section" ADD CONSTRAINT "pages_blocks_custom_section_definition_id_section_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."section_definitions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_custom_section" ADD CONSTRAINT "pages_blocks_custom_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_floating_cards" ADD CONSTRAINT "_pages_v_blocks_hero_floating_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_rich_text" ADD CONSTRAINT "_pages_v_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_product_grid" ADD CONSTRAINT "_pages_v_blocks_product_grid_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_product_grid" ADD CONSTRAINT "_pages_v_blocks_product_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_gallery" ADD CONSTRAINT "_pages_v_blocks_image_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cta_banner" ADD CONSTRAINT "_pages_v_blocks_cta_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_testimonials_items" ADD CONSTRAINT "_pages_v_blocks_testimonials_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_testimonials" ADD CONSTRAINT "_pages_v_blocks_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_items" ADD CONSTRAINT "_pages_v_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq" ADD CONSTRAINT "_pages_v_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_newsletter_signup" ADD CONSTRAINT "_pages_v_blocks_newsletter_signup_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_split_hero" ADD CONSTRAINT "_pages_v_blocks_split_hero_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_split_hero" ADD CONSTRAINT "_pages_v_blocks_split_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_spacer" ADD CONSTRAINT "_pages_v_blocks_spacer_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid_items" ADD CONSTRAINT "_pages_v_blocks_feature_grid_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid" ADD CONSTRAINT "_pages_v_blocks_feature_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_steps_steps" ADD CONSTRAINT "_pages_v_blocks_steps_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_steps" ADD CONSTRAINT "_pages_v_blocks_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_logo_strip_logos" ADD CONSTRAINT "_pages_v_blocks_logo_strip_logos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_logo_strip_logos" ADD CONSTRAINT "_pages_v_blocks_logo_strip_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_logo_strip"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_logo_strip" ADD CONSTRAINT "_pages_v_blocks_logo_strip_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_video_embed" ADD CONSTRAINT "_pages_v_blocks_video_embed_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_video_embed" ADD CONSTRAINT "_pages_v_blocks_video_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_contact_hours" ADD CONSTRAINT "_pages_v_blocks_contact_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_contact"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_contact" ADD CONSTRAINT "_pages_v_blocks_contact_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_featured_product" ADD CONSTRAINT "_pages_v_blocks_featured_product_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_featured_product" ADD CONSTRAINT "_pages_v_blocks_featured_product_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_incentives_items" ADD CONSTRAINT "_pages_v_blocks_incentives_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_incentives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_incentives" ADD CONSTRAINT "_pages_v_blocks_incentives_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_category_previews" ADD CONSTRAINT "_pages_v_blocks_category_previews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_promo_section" ADD CONSTRAINT "_pages_v_blocks_promo_section_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_promo_section" ADD CONSTRAINT "_pages_v_blocks_promo_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_reviews_items" ADD CONSTRAINT "_pages_v_blocks_reviews_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_reviews_items" ADD CONSTRAINT "_pages_v_blocks_reviews_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_reviews" ADD CONSTRAINT "_pages_v_blocks_reviews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_hero" ADD CONSTRAINT "_pages_v_blocks_media_hero_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_hero" ADD CONSTRAINT "_pages_v_blocks_media_hero_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_hero" ADD CONSTRAINT "_pages_v_blocks_media_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_ticker_items" ADD CONSTRAINT "_pages_v_blocks_ticker_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_ticker"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_ticker" ADD CONSTRAINT "_pages_v_blocks_ticker_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_story_stats_stats" ADD CONSTRAINT "_pages_v_blocks_story_stats_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_story_stats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_story_stats" ADD CONSTRAINT "_pages_v_blocks_story_stats_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_story_stats" ADD CONSTRAINT "_pages_v_blocks_story_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_custom_section" ADD CONSTRAINT "_pages_v_blocks_custom_section_definition_id_section_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."section_definitions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_custom_section" ADD CONSTRAINT "_pages_v_blocks_custom_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_settings_nav_links" ADD CONSTRAINT "store_settings_nav_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_settings_fulfillment_pickup_windows" ADD CONSTRAINT "store_settings_fulfillment_pickup_windows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_settings_fulfillment_delivery_zones" ADD CONSTRAINT "store_settings_fulfillment_delivery_zones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_settings_fulfillment_delivery_windows" ADD CONSTRAINT "store_settings_fulfillment_delivery_windows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_section_definitions_v" ADD CONSTRAINT "_section_definitions_v_parent_id_section_definitions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."section_definitions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_items_warnings" ADD CONSTRAINT "import_items_warnings_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."import_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_items" ADD CONSTRAINT "import_items_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_items" ADD CONSTRAINT "import_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "processed_webhook_events" ADD CONSTRAINT "processed_webhook_events_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoices_fk" FOREIGN KEY ("invoices_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discount_codes_fk" FOREIGN KEY ("discount_codes_id") REFERENCES "public"."discount_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_import_jobs_fk" FOREIGN KEY ("import_jobs_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_cards_fk" FOREIGN KEY ("gift_cards_id") REFERENCES "public"."gift_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gift_card_transactions_fk" FOREIGN KEY ("gift_card_transactions_id") REFERENCES "public"."gift_card_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaigns_fk" FOREIGN KEY ("campaigns_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contacts_fk" FOREIGN KEY ("contacts_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_marketing_configs_fk" FOREIGN KEY ("marketing_configs_id") REFERENCES "public"."marketing_configs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_store_settings_fk" FOREIGN KEY ("store_settings_id") REFERENCES "public"."store_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_section_definitions_fk" FOREIGN KEY ("section_definitions_id") REFERENCES "public"."section_definitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_import_items_fk" FOREIGN KEY ("import_items_id") REFERENCES "public"."import_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gateway_configs_fk" FOREIGN KEY ("gateway_configs_id") REFERENCES "public"."gateway_configs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payment_attempts_fk" FOREIGN KEY ("payment_attempts_id") REFERENCES "public"."payment_attempts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_processed_webhook_events_fk" FOREIGN KEY ("processed_webhook_events_id") REFERENCES "public"."processed_webhook_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payment_gateway_requests_fk" FOREIGN KEY ("payment_gateway_requests_id") REFERENCES "public"."payment_gateway_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_line_items_order_idx" ON "orders_line_items" USING btree ("_order");
  CREATE INDEX "orders_line_items_parent_id_idx" ON "orders_line_items" USING btree ("_parent_id");
  CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");
  CREATE INDEX "orders_gift_card_used_idx" ON "orders" USING btree ("gift_card_used_id");
  CREATE INDEX "orders_payment_attempt_idx" ON "orders" USING btree ("payment_attempt_id");
  CREATE INDEX "orders_invoice_pdf_idx" ON "orders" USING btree ("invoice_pdf_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE UNIQUE INDEX "orderNumber_idx" ON "orders" USING btree ("order_number");
  CREATE UNIQUE INDEX "providerEventId_idx" ON "orders" USING btree ("provider_event_id");
  CREATE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");
  CREATE INDEX "invoices_updated_at_idx" ON "invoices" USING btree ("updated_at");
  CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");
  CREATE UNIQUE INDEX "invoices_filename_idx" ON "invoices" USING btree ("filename");
  CREATE INDEX "products_options_values_order_idx" ON "products_options_values" USING btree ("_order");
  CREATE INDEX "products_options_values_parent_id_idx" ON "products_options_values" USING btree ("_parent_id");
  CREATE INDEX "products_options_order_idx" ON "products_options" USING btree ("_order");
  CREATE INDEX "products_options_parent_id_idx" ON "products_options" USING btree ("_parent_id");
  CREATE INDEX "products_variants_option_values_order_idx" ON "products_variants_option_values" USING btree ("_order");
  CREATE INDEX "products_variants_option_values_parent_id_idx" ON "products_variants_option_values" USING btree ("_parent_id");
  CREATE INDEX "products_variants_order_idx" ON "products_variants" USING btree ("_order");
  CREATE INDEX "products_variants_parent_id_idx" ON "products_variants" USING btree ("_parent_id");
  CREATE INDEX "products_specifications_order_idx" ON "products_specifications" USING btree ("_order");
  CREATE INDEX "products_specifications_parent_id_idx" ON "products_specifications" USING btree ("_parent_id");
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE INDEX "products_imported_from_imported_from_external_id_idx" ON "products" USING btree ("imported_from_external_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE UNIQUE INDEX "slug_idx" ON "products" USING btree ("slug");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_media_id_idx" ON "products_rels" USING btree ("media_id");
  CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_image_idx" ON "categories" USING btree ("image_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "slug_1_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "discount_codes_code_idx" ON "discount_codes" USING btree ("code");
  CREATE INDEX "discount_codes_updated_at_idx" ON "discount_codes" USING btree ("updated_at");
  CREATE INDEX "discount_codes_created_at_idx" ON "discount_codes" USING btree ("created_at");
  CREATE INDEX "import_jobs_status_idx" ON "import_jobs" USING btree ("status");
  CREATE INDEX "import_jobs_ownership_attested_by_idx" ON "import_jobs" USING btree ("ownership_attested_by_id");
  CREATE INDEX "import_jobs_created_by_idx" ON "import_jobs" USING btree ("created_by_id");
  CREATE INDEX "import_jobs_updated_at_idx" ON "import_jobs" USING btree ("updated_at");
  CREATE INDEX "import_jobs_created_at_idx" ON "import_jobs" USING btree ("created_at");
  CREATE INDEX "status_idx" ON "import_jobs" USING btree ("status");
  CREATE INDEX "gift_cards_code_hash_idx" ON "gift_cards" USING btree ("code_hash");
  CREATE INDEX "gift_cards_issued_from_order_idx" ON "gift_cards" USING btree ("issued_from_order_id");
  CREATE INDEX "gift_cards_updated_at_idx" ON "gift_cards" USING btree ("updated_at");
  CREATE INDEX "gift_cards_created_at_idx" ON "gift_cards" USING btree ("created_at");
  CREATE INDEX "gift_card_transactions_gift_card_idx" ON "gift_card_transactions" USING btree ("gift_card_id");
  CREATE INDEX "gift_card_transactions_order_idx" ON "gift_card_transactions" USING btree ("order_id");
  CREATE INDEX "gift_card_transactions_updated_at_idx" ON "gift_card_transactions" USING btree ("updated_at");
  CREATE INDEX "gift_card_transactions_created_at_idx" ON "gift_card_transactions" USING btree ("created_at");
  CREATE INDEX "customers_addresses_order_idx" ON "customers_addresses" USING btree ("_order");
  CREATE INDEX "customers_addresses_parent_id_idx" ON "customers_addresses" USING btree ("_parent_id");
  CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "campaigns_updated_at_idx" ON "campaigns" USING btree ("updated_at");
  CREATE INDEX "campaigns_created_at_idx" ON "campaigns" USING btree ("created_at");
  CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");
  CREATE INDEX "contacts_updated_at_idx" ON "contacts" USING btree ("updated_at");
  CREATE INDEX "contacts_created_at_idx" ON "contacts" USING btree ("created_at");
  CREATE INDEX "contacts_texts_order_parent" ON "contacts_texts" USING btree ("order","parent_id");
  CREATE INDEX "marketing_configs_updated_at_idx" ON "marketing_configs" USING btree ("updated_at");
  CREATE INDEX "marketing_configs_created_at_idx" ON "marketing_configs" USING btree ("created_at");
  CREATE INDEX "pages_blocks_hero_floating_cards_order_idx" ON "pages_blocks_hero_floating_cards" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_floating_cards_parent_id_idx" ON "pages_blocks_hero_floating_cards" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_order_idx" ON "pages_blocks_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_parent_id_idx" ON "pages_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_path_idx" ON "pages_blocks_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_media_idx" ON "pages_blocks_hero" USING btree ("media_id");
  CREATE INDEX "pages_blocks_hero_poster_idx" ON "pages_blocks_hero" USING btree ("poster_id");
  CREATE INDEX "pages_blocks_hero_background_image_idx" ON "pages_blocks_hero" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_rich_text_order_idx" ON "pages_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "pages_blocks_rich_text_parent_id_idx" ON "pages_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_rich_text_path_idx" ON "pages_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "pages_blocks_product_grid_order_idx" ON "pages_blocks_product_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_product_grid_parent_id_idx" ON "pages_blocks_product_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_product_grid_path_idx" ON "pages_blocks_product_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_product_grid_category_idx" ON "pages_blocks_product_grid" USING btree ("category_id");
  CREATE INDEX "pages_blocks_image_gallery_order_idx" ON "pages_blocks_image_gallery" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_gallery_parent_id_idx" ON "pages_blocks_image_gallery" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_gallery_path_idx" ON "pages_blocks_image_gallery" USING btree ("_path");
  CREATE INDEX "pages_blocks_cta_banner_order_idx" ON "pages_blocks_cta_banner" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_banner_parent_id_idx" ON "pages_blocks_cta_banner" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_banner_path_idx" ON "pages_blocks_cta_banner" USING btree ("_path");
  CREATE INDEX "pages_blocks_testimonials_items_order_idx" ON "pages_blocks_testimonials_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_testimonials_items_parent_id_idx" ON "pages_blocks_testimonials_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_testimonials_order_idx" ON "pages_blocks_testimonials" USING btree ("_order");
  CREATE INDEX "pages_blocks_testimonials_parent_id_idx" ON "pages_blocks_testimonials" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_testimonials_path_idx" ON "pages_blocks_testimonials" USING btree ("_path");
  CREATE INDEX "pages_blocks_faq_items_order_idx" ON "pages_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_items_parent_id_idx" ON "pages_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_order_idx" ON "pages_blocks_faq" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_parent_id_idx" ON "pages_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_path_idx" ON "pages_blocks_faq" USING btree ("_path");
  CREATE INDEX "pages_blocks_newsletter_signup_order_idx" ON "pages_blocks_newsletter_signup" USING btree ("_order");
  CREATE INDEX "pages_blocks_newsletter_signup_parent_id_idx" ON "pages_blocks_newsletter_signup" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_newsletter_signup_path_idx" ON "pages_blocks_newsletter_signup" USING btree ("_path");
  CREATE INDEX "pages_blocks_split_hero_order_idx" ON "pages_blocks_split_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_split_hero_parent_id_idx" ON "pages_blocks_split_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_split_hero_path_idx" ON "pages_blocks_split_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_split_hero_media_idx" ON "pages_blocks_split_hero" USING btree ("media_id");
  CREATE INDEX "pages_blocks_spacer_order_idx" ON "pages_blocks_spacer" USING btree ("_order");
  CREATE INDEX "pages_blocks_spacer_parent_id_idx" ON "pages_blocks_spacer" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_spacer_path_idx" ON "pages_blocks_spacer" USING btree ("_path");
  CREATE INDEX "pages_blocks_feature_grid_items_order_idx" ON "pages_blocks_feature_grid_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_feature_grid_items_parent_id_idx" ON "pages_blocks_feature_grid_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_order_idx" ON "pages_blocks_feature_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_feature_grid_parent_id_idx" ON "pages_blocks_feature_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_path_idx" ON "pages_blocks_feature_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_steps_steps_order_idx" ON "pages_blocks_steps_steps" USING btree ("_order");
  CREATE INDEX "pages_blocks_steps_steps_parent_id_idx" ON "pages_blocks_steps_steps" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_steps_order_idx" ON "pages_blocks_steps" USING btree ("_order");
  CREATE INDEX "pages_blocks_steps_parent_id_idx" ON "pages_blocks_steps" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_steps_path_idx" ON "pages_blocks_steps" USING btree ("_path");
  CREATE INDEX "pages_blocks_logo_strip_logos_order_idx" ON "pages_blocks_logo_strip_logos" USING btree ("_order");
  CREATE INDEX "pages_blocks_logo_strip_logos_parent_id_idx" ON "pages_blocks_logo_strip_logos" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_logo_strip_logos_image_idx" ON "pages_blocks_logo_strip_logos" USING btree ("image_id");
  CREATE INDEX "pages_blocks_logo_strip_order_idx" ON "pages_blocks_logo_strip" USING btree ("_order");
  CREATE INDEX "pages_blocks_logo_strip_parent_id_idx" ON "pages_blocks_logo_strip" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_logo_strip_path_idx" ON "pages_blocks_logo_strip" USING btree ("_path");
  CREATE INDEX "pages_blocks_video_embed_order_idx" ON "pages_blocks_video_embed" USING btree ("_order");
  CREATE INDEX "pages_blocks_video_embed_parent_id_idx" ON "pages_blocks_video_embed" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_video_embed_path_idx" ON "pages_blocks_video_embed" USING btree ("_path");
  CREATE INDEX "pages_blocks_video_embed_poster_idx" ON "pages_blocks_video_embed" USING btree ("poster_id");
  CREATE INDEX "pages_blocks_contact_hours_order_idx" ON "pages_blocks_contact_hours" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_hours_parent_id_idx" ON "pages_blocks_contact_hours" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_order_idx" ON "pages_blocks_contact" USING btree ("_order");
  CREATE INDEX "pages_blocks_contact_parent_id_idx" ON "pages_blocks_contact" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_contact_path_idx" ON "pages_blocks_contact" USING btree ("_path");
  CREATE INDEX "pages_blocks_featured_product_order_idx" ON "pages_blocks_featured_product" USING btree ("_order");
  CREATE INDEX "pages_blocks_featured_product_parent_id_idx" ON "pages_blocks_featured_product" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_featured_product_path_idx" ON "pages_blocks_featured_product" USING btree ("_path");
  CREATE INDEX "pages_blocks_featured_product_product_idx" ON "pages_blocks_featured_product" USING btree ("product_id");
  CREATE INDEX "pages_blocks_incentives_items_order_idx" ON "pages_blocks_incentives_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_incentives_items_parent_id_idx" ON "pages_blocks_incentives_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_incentives_order_idx" ON "pages_blocks_incentives" USING btree ("_order");
  CREATE INDEX "pages_blocks_incentives_parent_id_idx" ON "pages_blocks_incentives" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_incentives_path_idx" ON "pages_blocks_incentives" USING btree ("_path");
  CREATE INDEX "pages_blocks_category_previews_order_idx" ON "pages_blocks_category_previews" USING btree ("_order");
  CREATE INDEX "pages_blocks_category_previews_parent_id_idx" ON "pages_blocks_category_previews" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_category_previews_path_idx" ON "pages_blocks_category_previews" USING btree ("_path");
  CREATE INDEX "pages_blocks_promo_section_order_idx" ON "pages_blocks_promo_section" USING btree ("_order");
  CREATE INDEX "pages_blocks_promo_section_parent_id_idx" ON "pages_blocks_promo_section" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_promo_section_path_idx" ON "pages_blocks_promo_section" USING btree ("_path");
  CREATE INDEX "pages_blocks_promo_section_media_idx" ON "pages_blocks_promo_section" USING btree ("media_id");
  CREATE INDEX "pages_blocks_reviews_items_order_idx" ON "pages_blocks_reviews_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_reviews_items_parent_id_idx" ON "pages_blocks_reviews_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_reviews_items_product_idx" ON "pages_blocks_reviews_items" USING btree ("product_id");
  CREATE INDEX "pages_blocks_reviews_order_idx" ON "pages_blocks_reviews" USING btree ("_order");
  CREATE INDEX "pages_blocks_reviews_parent_id_idx" ON "pages_blocks_reviews" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_reviews_path_idx" ON "pages_blocks_reviews" USING btree ("_path");
  CREATE INDEX "pages_blocks_media_hero_order_idx" ON "pages_blocks_media_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_media_hero_parent_id_idx" ON "pages_blocks_media_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_media_hero_path_idx" ON "pages_blocks_media_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_media_hero_media_idx" ON "pages_blocks_media_hero" USING btree ("media_id");
  CREATE INDEX "pages_blocks_media_hero_poster_idx" ON "pages_blocks_media_hero" USING btree ("poster_id");
  CREATE INDEX "pages_blocks_ticker_items_order_idx" ON "pages_blocks_ticker_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_ticker_items_parent_id_idx" ON "pages_blocks_ticker_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_ticker_order_idx" ON "pages_blocks_ticker" USING btree ("_order");
  CREATE INDEX "pages_blocks_ticker_parent_id_idx" ON "pages_blocks_ticker" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_ticker_path_idx" ON "pages_blocks_ticker" USING btree ("_path");
  CREATE INDEX "pages_blocks_story_stats_stats_order_idx" ON "pages_blocks_story_stats_stats" USING btree ("_order");
  CREATE INDEX "pages_blocks_story_stats_stats_parent_id_idx" ON "pages_blocks_story_stats_stats" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_story_stats_order_idx" ON "pages_blocks_story_stats" USING btree ("_order");
  CREATE INDEX "pages_blocks_story_stats_parent_id_idx" ON "pages_blocks_story_stats" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_story_stats_path_idx" ON "pages_blocks_story_stats" USING btree ("_path");
  CREATE INDEX "pages_blocks_story_stats_image_idx" ON "pages_blocks_story_stats" USING btree ("image_id");
  CREATE INDEX "pages_blocks_custom_section_order_idx" ON "pages_blocks_custom_section" USING btree ("_order");
  CREATE INDEX "pages_blocks_custom_section_parent_id_idx" ON "pages_blocks_custom_section" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_custom_section_path_idx" ON "pages_blocks_custom_section" USING btree ("_path");
  CREATE INDEX "pages_blocks_custom_section_definition_idx" ON "pages_blocks_custom_section" USING btree ("definition_id");
  CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages" USING btree ("meta_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "pages_rels_order_idx" ON "pages_rels" USING btree ("order");
  CREATE INDEX "pages_rels_parent_idx" ON "pages_rels" USING btree ("parent_id");
  CREATE INDEX "pages_rels_path_idx" ON "pages_rels" USING btree ("path");
  CREATE INDEX "pages_rels_products_id_idx" ON "pages_rels" USING btree ("products_id");
  CREATE INDEX "pages_rels_media_id_idx" ON "pages_rels" USING btree ("media_id");
  CREATE INDEX "pages_rels_categories_id_idx" ON "pages_rels" USING btree ("categories_id");
  CREATE INDEX "_pages_v_blocks_hero_floating_cards_order_idx" ON "_pages_v_blocks_hero_floating_cards" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_floating_cards_parent_id_idx" ON "_pages_v_blocks_hero_floating_cards" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_order_idx" ON "_pages_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_parent_id_idx" ON "_pages_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_path_idx" ON "_pages_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_hero_media_idx" ON "_pages_v_blocks_hero" USING btree ("media_id");
  CREATE INDEX "_pages_v_blocks_hero_poster_idx" ON "_pages_v_blocks_hero" USING btree ("poster_id");
  CREATE INDEX "_pages_v_blocks_hero_background_image_idx" ON "_pages_v_blocks_hero" USING btree ("background_image_id");
  CREATE INDEX "_pages_v_blocks_rich_text_order_idx" ON "_pages_v_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_rich_text_parent_id_idx" ON "_pages_v_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_rich_text_path_idx" ON "_pages_v_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_product_grid_order_idx" ON "_pages_v_blocks_product_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_product_grid_parent_id_idx" ON "_pages_v_blocks_product_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_product_grid_path_idx" ON "_pages_v_blocks_product_grid" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_product_grid_category_idx" ON "_pages_v_blocks_product_grid" USING btree ("category_id");
  CREATE INDEX "_pages_v_blocks_image_gallery_order_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_image_gallery_parent_id_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_image_gallery_path_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_cta_banner_order_idx" ON "_pages_v_blocks_cta_banner" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_banner_parent_id_idx" ON "_pages_v_blocks_cta_banner" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_banner_path_idx" ON "_pages_v_blocks_cta_banner" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_testimonials_items_order_idx" ON "_pages_v_blocks_testimonials_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_testimonials_items_parent_id_idx" ON "_pages_v_blocks_testimonials_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_testimonials_order_idx" ON "_pages_v_blocks_testimonials" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_testimonials_parent_id_idx" ON "_pages_v_blocks_testimonials" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_testimonials_path_idx" ON "_pages_v_blocks_testimonials" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_faq_items_order_idx" ON "_pages_v_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_items_parent_id_idx" ON "_pages_v_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_order_idx" ON "_pages_v_blocks_faq" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_parent_id_idx" ON "_pages_v_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_path_idx" ON "_pages_v_blocks_faq" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_newsletter_signup_order_idx" ON "_pages_v_blocks_newsletter_signup" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_newsletter_signup_parent_id_idx" ON "_pages_v_blocks_newsletter_signup" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_newsletter_signup_path_idx" ON "_pages_v_blocks_newsletter_signup" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_split_hero_order_idx" ON "_pages_v_blocks_split_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_split_hero_parent_id_idx" ON "_pages_v_blocks_split_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_split_hero_path_idx" ON "_pages_v_blocks_split_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_split_hero_media_idx" ON "_pages_v_blocks_split_hero" USING btree ("media_id");
  CREATE INDEX "_pages_v_blocks_spacer_order_idx" ON "_pages_v_blocks_spacer" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_spacer_parent_id_idx" ON "_pages_v_blocks_spacer" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_spacer_path_idx" ON "_pages_v_blocks_spacer" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_feature_grid_items_order_idx" ON "_pages_v_blocks_feature_grid_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_feature_grid_items_parent_id_idx" ON "_pages_v_blocks_feature_grid_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_order_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_feature_grid_parent_id_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_path_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_steps_steps_order_idx" ON "_pages_v_blocks_steps_steps" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_steps_steps_parent_id_idx" ON "_pages_v_blocks_steps_steps" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_steps_order_idx" ON "_pages_v_blocks_steps" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_steps_parent_id_idx" ON "_pages_v_blocks_steps" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_steps_path_idx" ON "_pages_v_blocks_steps" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_logo_strip_logos_order_idx" ON "_pages_v_blocks_logo_strip_logos" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_logo_strip_logos_parent_id_idx" ON "_pages_v_blocks_logo_strip_logos" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_logo_strip_logos_image_idx" ON "_pages_v_blocks_logo_strip_logos" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_logo_strip_order_idx" ON "_pages_v_blocks_logo_strip" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_logo_strip_parent_id_idx" ON "_pages_v_blocks_logo_strip" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_logo_strip_path_idx" ON "_pages_v_blocks_logo_strip" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_video_embed_order_idx" ON "_pages_v_blocks_video_embed" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_video_embed_parent_id_idx" ON "_pages_v_blocks_video_embed" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_video_embed_path_idx" ON "_pages_v_blocks_video_embed" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_video_embed_poster_idx" ON "_pages_v_blocks_video_embed" USING btree ("poster_id");
  CREATE INDEX "_pages_v_blocks_contact_hours_order_idx" ON "_pages_v_blocks_contact_hours" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_contact_hours_parent_id_idx" ON "_pages_v_blocks_contact_hours" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_contact_order_idx" ON "_pages_v_blocks_contact" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_contact_parent_id_idx" ON "_pages_v_blocks_contact" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_contact_path_idx" ON "_pages_v_blocks_contact" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_featured_product_order_idx" ON "_pages_v_blocks_featured_product" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_featured_product_parent_id_idx" ON "_pages_v_blocks_featured_product" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_featured_product_path_idx" ON "_pages_v_blocks_featured_product" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_featured_product_product_idx" ON "_pages_v_blocks_featured_product" USING btree ("product_id");
  CREATE INDEX "_pages_v_blocks_incentives_items_order_idx" ON "_pages_v_blocks_incentives_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_incentives_items_parent_id_idx" ON "_pages_v_blocks_incentives_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_incentives_order_idx" ON "_pages_v_blocks_incentives" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_incentives_parent_id_idx" ON "_pages_v_blocks_incentives" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_incentives_path_idx" ON "_pages_v_blocks_incentives" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_category_previews_order_idx" ON "_pages_v_blocks_category_previews" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_category_previews_parent_id_idx" ON "_pages_v_blocks_category_previews" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_category_previews_path_idx" ON "_pages_v_blocks_category_previews" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_promo_section_order_idx" ON "_pages_v_blocks_promo_section" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_promo_section_parent_id_idx" ON "_pages_v_blocks_promo_section" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_promo_section_path_idx" ON "_pages_v_blocks_promo_section" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_promo_section_media_idx" ON "_pages_v_blocks_promo_section" USING btree ("media_id");
  CREATE INDEX "_pages_v_blocks_reviews_items_order_idx" ON "_pages_v_blocks_reviews_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_reviews_items_parent_id_idx" ON "_pages_v_blocks_reviews_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_reviews_items_product_idx" ON "_pages_v_blocks_reviews_items" USING btree ("product_id");
  CREATE INDEX "_pages_v_blocks_reviews_order_idx" ON "_pages_v_blocks_reviews" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_reviews_parent_id_idx" ON "_pages_v_blocks_reviews" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_reviews_path_idx" ON "_pages_v_blocks_reviews" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_media_hero_order_idx" ON "_pages_v_blocks_media_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_media_hero_parent_id_idx" ON "_pages_v_blocks_media_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_media_hero_path_idx" ON "_pages_v_blocks_media_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_media_hero_media_idx" ON "_pages_v_blocks_media_hero" USING btree ("media_id");
  CREATE INDEX "_pages_v_blocks_media_hero_poster_idx" ON "_pages_v_blocks_media_hero" USING btree ("poster_id");
  CREATE INDEX "_pages_v_blocks_ticker_items_order_idx" ON "_pages_v_blocks_ticker_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_ticker_items_parent_id_idx" ON "_pages_v_blocks_ticker_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_ticker_order_idx" ON "_pages_v_blocks_ticker" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_ticker_parent_id_idx" ON "_pages_v_blocks_ticker" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_ticker_path_idx" ON "_pages_v_blocks_ticker" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_story_stats_stats_order_idx" ON "_pages_v_blocks_story_stats_stats" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_story_stats_stats_parent_id_idx" ON "_pages_v_blocks_story_stats_stats" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_story_stats_order_idx" ON "_pages_v_blocks_story_stats" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_story_stats_parent_id_idx" ON "_pages_v_blocks_story_stats" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_story_stats_path_idx" ON "_pages_v_blocks_story_stats" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_story_stats_image_idx" ON "_pages_v_blocks_story_stats" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_custom_section_order_idx" ON "_pages_v_blocks_custom_section" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_custom_section_parent_id_idx" ON "_pages_v_blocks_custom_section" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_custom_section_path_idx" ON "_pages_v_blocks_custom_section" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_custom_section_definition_idx" ON "_pages_v_blocks_custom_section" USING btree ("definition_id");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "_pages_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_rels_order_idx" ON "_pages_v_rels" USING btree ("order");
  CREATE INDEX "_pages_v_rels_parent_idx" ON "_pages_v_rels" USING btree ("parent_id");
  CREATE INDEX "_pages_v_rels_path_idx" ON "_pages_v_rels" USING btree ("path");
  CREATE INDEX "_pages_v_rels_products_id_idx" ON "_pages_v_rels" USING btree ("products_id");
  CREATE INDEX "_pages_v_rels_media_id_idx" ON "_pages_v_rels" USING btree ("media_id");
  CREATE INDEX "_pages_v_rels_categories_id_idx" ON "_pages_v_rels" USING btree ("categories_id");
  CREATE INDEX "media_content_hash_idx" ON "media" USING btree ("content_hash");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE INDEX "store_settings_nav_links_order_idx" ON "store_settings_nav_links" USING btree ("_order");
  CREATE INDEX "store_settings_nav_links_parent_id_idx" ON "store_settings_nav_links" USING btree ("_parent_id");
  CREATE INDEX "store_settings_fulfillment_pickup_windows_order_idx" ON "store_settings_fulfillment_pickup_windows" USING btree ("_order");
  CREATE INDEX "store_settings_fulfillment_pickup_windows_parent_id_idx" ON "store_settings_fulfillment_pickup_windows" USING btree ("_parent_id");
  CREATE INDEX "store_settings_fulfillment_delivery_zones_order_idx" ON "store_settings_fulfillment_delivery_zones" USING btree ("_order");
  CREATE INDEX "store_settings_fulfillment_delivery_zones_parent_id_idx" ON "store_settings_fulfillment_delivery_zones" USING btree ("_parent_id");
  CREATE INDEX "store_settings_fulfillment_delivery_windows_order_idx" ON "store_settings_fulfillment_delivery_windows" USING btree ("_order");
  CREATE INDEX "store_settings_fulfillment_delivery_windows_parent_id_idx" ON "store_settings_fulfillment_delivery_windows" USING btree ("_parent_id");
  CREATE INDEX "store_settings_logo_idx" ON "store_settings" USING btree ("logo_id");
  CREATE INDEX "store_settings_updated_at_idx" ON "store_settings" USING btree ("updated_at");
  CREATE INDEX "store_settings_created_at_idx" ON "store_settings" USING btree ("created_at");
  CREATE INDEX "section_definitions_updated_at_idx" ON "section_definitions" USING btree ("updated_at");
  CREATE INDEX "section_definitions_created_at_idx" ON "section_definitions" USING btree ("created_at");
  CREATE INDEX "section_definitions__status_idx" ON "section_definitions" USING btree ("_status");
  CREATE INDEX "_section_definitions_v_parent_idx" ON "_section_definitions_v" USING btree ("parent_id");
  CREATE INDEX "_section_definitions_v_version_version_updated_at_idx" ON "_section_definitions_v" USING btree ("version_updated_at");
  CREATE INDEX "_section_definitions_v_version_version_created_at_idx" ON "_section_definitions_v" USING btree ("version_created_at");
  CREATE INDEX "_section_definitions_v_version_version__status_idx" ON "_section_definitions_v" USING btree ("version__status");
  CREATE INDEX "_section_definitions_v_created_at_idx" ON "_section_definitions_v" USING btree ("created_at");
  CREATE INDEX "_section_definitions_v_updated_at_idx" ON "_section_definitions_v" USING btree ("updated_at");
  CREATE INDEX "_section_definitions_v_latest_idx" ON "_section_definitions_v" USING btree ("latest");
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "import_items_warnings_order_idx" ON "import_items_warnings" USING btree ("order");
  CREATE INDEX "import_items_warnings_parent_idx" ON "import_items_warnings" USING btree ("parent_id");
  CREATE INDEX "import_items_job_idx" ON "import_items" USING btree ("job_id");
  CREATE INDEX "import_items_status_idx" ON "import_items" USING btree ("status");
  CREATE INDEX "import_items_claimed_at_idx" ON "import_items" USING btree ("claimed_at");
  CREATE INDEX "import_items_product_idx" ON "import_items" USING btree ("product_id");
  CREATE INDEX "import_items_updated_at_idx" ON "import_items" USING btree ("updated_at");
  CREATE INDEX "import_items_created_at_idx" ON "import_items" USING btree ("created_at");
  CREATE INDEX "job_status_idx" ON "import_items" USING btree ("job_id","status");
  CREATE UNIQUE INDEX "job_externalId_idx" ON "import_items" USING btree ("job_id","external_id");
  CREATE INDEX "gateway_configs_updated_at_idx" ON "gateway_configs" USING btree ("updated_at");
  CREATE INDEX "gateway_configs_created_at_idx" ON "gateway_configs" USING btree ("created_at");
  CREATE UNIQUE INDEX "provider_idx" ON "gateway_configs" USING btree ("provider");
  CREATE INDEX "payment_attempts_order_idx" ON "payment_attempts" USING btree ("order_id");
  CREATE INDEX "payment_attempts_updated_at_idx" ON "payment_attempts" USING btree ("updated_at");
  CREATE INDEX "payment_attempts_created_at_idx" ON "payment_attempts" USING btree ("created_at");
  CREATE UNIQUE INDEX "provider_providerSessionId_idx" ON "payment_attempts" USING btree ("provider","provider_session_id");
  CREATE UNIQUE INDEX "order_idempotencyKey_idx" ON "payment_attempts" USING btree ("order_id","idempotency_key");
  CREATE INDEX "processed_webhook_events_payment_attempt_idx" ON "processed_webhook_events" USING btree ("payment_attempt_id");
  CREATE INDEX "processed_webhook_events_updated_at_idx" ON "processed_webhook_events" USING btree ("updated_at");
  CREATE INDEX "processed_webhook_events_created_at_idx" ON "processed_webhook_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "provider_providerEventId_idx" ON "processed_webhook_events" USING btree ("provider","provider_event_id");
  CREATE INDEX "payment_gateway_requests_updated_at_idx" ON "payment_gateway_requests" USING btree ("updated_at");
  CREATE INDEX "payment_gateway_requests_created_at_idx" ON "payment_gateway_requests" USING btree ("created_at");
  CREATE INDEX "payload_mcp_api_keys_user_idx" ON "payload_mcp_api_keys" USING btree ("user_id");
  CREATE INDEX "payload_mcp_api_keys_updated_at_idx" ON "payload_mcp_api_keys" USING btree ("updated_at");
  CREATE INDEX "payload_mcp_api_keys_created_at_idx" ON "payload_mcp_api_keys" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("invoices_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_discount_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("discount_codes_id");
  CREATE INDEX "payload_locked_documents_rels_import_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("import_jobs_id");
  CREATE INDEX "payload_locked_documents_rels_gift_cards_id_idx" ON "payload_locked_documents_rels" USING btree ("gift_cards_id");
  CREATE INDEX "payload_locked_documents_rels_gift_card_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("gift_card_transactions_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("campaigns_id");
  CREATE INDEX "payload_locked_documents_rels_contacts_id_idx" ON "payload_locked_documents_rels" USING btree ("contacts_id");
  CREATE INDEX "payload_locked_documents_rels_marketing_configs_id_idx" ON "payload_locked_documents_rels" USING btree ("marketing_configs_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_store_settings_id_idx" ON "payload_locked_documents_rels" USING btree ("store_settings_id");
  CREATE INDEX "payload_locked_documents_rels_section_definitions_id_idx" ON "payload_locked_documents_rels" USING btree ("section_definitions_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_import_items_id_idx" ON "payload_locked_documents_rels" USING btree ("import_items_id");
  CREATE INDEX "payload_locked_documents_rels_gateway_configs_id_idx" ON "payload_locked_documents_rels" USING btree ("gateway_configs_id");
  CREATE INDEX "payload_locked_documents_rels_payment_attempts_id_idx" ON "payload_locked_documents_rels" USING btree ("payment_attempts_id");
  CREATE INDEX "payload_locked_documents_rels_processed_webhook_events_i_idx" ON "payload_locked_documents_rels" USING btree ("processed_webhook_events_id");
  CREATE INDEX "payload_locked_documents_rels_payment_gateway_requests_i_idx" ON "payload_locked_documents_rels" USING btree ("payment_gateway_requests_id");
  CREATE INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx" ON "payload_preferences_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "orders_line_items" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "invoices" CASCADE;
  DROP TABLE "products_options_values" CASCADE;
  DROP TABLE "products_options" CASCADE;
  DROP TABLE "products_variants_option_values" CASCADE;
  DROP TABLE "products_variants" CASCADE;
  DROP TABLE "products_specifications" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "discount_codes" CASCADE;
  DROP TABLE "import_jobs" CASCADE;
  DROP TABLE "gift_cards" CASCADE;
  DROP TABLE "gift_card_transactions" CASCADE;
  DROP TABLE "customers_addresses" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "campaigns" CASCADE;
  DROP TABLE "contacts" CASCADE;
  DROP TABLE "contacts_texts" CASCADE;
  DROP TABLE "marketing_configs" CASCADE;
  DROP TABLE "pages_blocks_hero_floating_cards" CASCADE;
  DROP TABLE "pages_blocks_hero" CASCADE;
  DROP TABLE "pages_blocks_rich_text" CASCADE;
  DROP TABLE "pages_blocks_product_grid" CASCADE;
  DROP TABLE "pages_blocks_image_gallery" CASCADE;
  DROP TABLE "pages_blocks_cta_banner" CASCADE;
  DROP TABLE "pages_blocks_testimonials_items" CASCADE;
  DROP TABLE "pages_blocks_testimonials" CASCADE;
  DROP TABLE "pages_blocks_faq_items" CASCADE;
  DROP TABLE "pages_blocks_faq" CASCADE;
  DROP TABLE "pages_blocks_newsletter_signup" CASCADE;
  DROP TABLE "pages_blocks_split_hero" CASCADE;
  DROP TABLE "pages_blocks_spacer" CASCADE;
  DROP TABLE "pages_blocks_feature_grid_items" CASCADE;
  DROP TABLE "pages_blocks_feature_grid" CASCADE;
  DROP TABLE "pages_blocks_steps_steps" CASCADE;
  DROP TABLE "pages_blocks_steps" CASCADE;
  DROP TABLE "pages_blocks_logo_strip_logos" CASCADE;
  DROP TABLE "pages_blocks_logo_strip" CASCADE;
  DROP TABLE "pages_blocks_video_embed" CASCADE;
  DROP TABLE "pages_blocks_contact_hours" CASCADE;
  DROP TABLE "pages_blocks_contact" CASCADE;
  DROP TABLE "pages_blocks_featured_product" CASCADE;
  DROP TABLE "pages_blocks_incentives_items" CASCADE;
  DROP TABLE "pages_blocks_incentives" CASCADE;
  DROP TABLE "pages_blocks_category_previews" CASCADE;
  DROP TABLE "pages_blocks_promo_section" CASCADE;
  DROP TABLE "pages_blocks_reviews_items" CASCADE;
  DROP TABLE "pages_blocks_reviews" CASCADE;
  DROP TABLE "pages_blocks_media_hero" CASCADE;
  DROP TABLE "pages_blocks_ticker_items" CASCADE;
  DROP TABLE "pages_blocks_ticker" CASCADE;
  DROP TABLE "pages_blocks_story_stats_stats" CASCADE;
  DROP TABLE "pages_blocks_story_stats" CASCADE;
  DROP TABLE "pages_blocks_custom_section" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_rels" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_floating_cards" CASCADE;
  DROP TABLE "_pages_v_blocks_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_rich_text" CASCADE;
  DROP TABLE "_pages_v_blocks_product_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_image_gallery" CASCADE;
  DROP TABLE "_pages_v_blocks_cta_banner" CASCADE;
  DROP TABLE "_pages_v_blocks_testimonials_items" CASCADE;
  DROP TABLE "_pages_v_blocks_testimonials" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_items" CASCADE;
  DROP TABLE "_pages_v_blocks_faq" CASCADE;
  DROP TABLE "_pages_v_blocks_newsletter_signup" CASCADE;
  DROP TABLE "_pages_v_blocks_split_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_spacer" CASCADE;
  DROP TABLE "_pages_v_blocks_feature_grid_items" CASCADE;
  DROP TABLE "_pages_v_blocks_feature_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_steps_steps" CASCADE;
  DROP TABLE "_pages_v_blocks_steps" CASCADE;
  DROP TABLE "_pages_v_blocks_logo_strip_logos" CASCADE;
  DROP TABLE "_pages_v_blocks_logo_strip" CASCADE;
  DROP TABLE "_pages_v_blocks_video_embed" CASCADE;
  DROP TABLE "_pages_v_blocks_contact_hours" CASCADE;
  DROP TABLE "_pages_v_blocks_contact" CASCADE;
  DROP TABLE "_pages_v_blocks_featured_product" CASCADE;
  DROP TABLE "_pages_v_blocks_incentives_items" CASCADE;
  DROP TABLE "_pages_v_blocks_incentives" CASCADE;
  DROP TABLE "_pages_v_blocks_category_previews" CASCADE;
  DROP TABLE "_pages_v_blocks_promo_section" CASCADE;
  DROP TABLE "_pages_v_blocks_reviews_items" CASCADE;
  DROP TABLE "_pages_v_blocks_reviews" CASCADE;
  DROP TABLE "_pages_v_blocks_media_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_ticker_items" CASCADE;
  DROP TABLE "_pages_v_blocks_ticker" CASCADE;
  DROP TABLE "_pages_v_blocks_story_stats_stats" CASCADE;
  DROP TABLE "_pages_v_blocks_story_stats" CASCADE;
  DROP TABLE "_pages_v_blocks_custom_section" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "_pages_v_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "store_settings_nav_links" CASCADE;
  DROP TABLE "store_settings_fulfillment_pickup_windows" CASCADE;
  DROP TABLE "store_settings_fulfillment_delivery_zones" CASCADE;
  DROP TABLE "store_settings_fulfillment_delivery_windows" CASCADE;
  DROP TABLE "store_settings" CASCADE;
  DROP TABLE "section_definitions" CASCADE;
  DROP TABLE "_section_definitions_v" CASCADE;
  DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "import_items_warnings" CASCADE;
  DROP TABLE "import_items" CASCADE;
  DROP TABLE "gateway_configs" CASCADE;
  DROP TABLE "payment_attempts" CASCADE;
  DROP TABLE "processed_webhook_events" CASCADE;
  DROP TABLE "payment_gateway_requests" CASCADE;
  DROP TABLE "payload_mcp_api_keys" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_orders_fulfillment_method";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum_products_imported_from_price_tax_treatment";
  DROP TYPE "public"."enum_discount_codes_type";
  DROP TYPE "public"."enum_import_jobs_status";
  DROP TYPE "public"."enum_import_jobs_price_tax_treatment";
  DROP TYPE "public"."enum_gift_cards_status";
  DROP TYPE "public"."enum_gift_card_transactions_type";
  DROP TYPE "public"."enum_campaigns_audience_mode";
  DROP TYPE "public"."enum_campaigns_audience_source";
  DROP TYPE "public"."enum_campaigns_status";
  DROP TYPE "public"."enum_contacts_status";
  DROP TYPE "public"."enum_contacts_source";
  DROP TYPE "public"."enum_pages_blocks_hero_floating_cards_corner";
  DROP TYPE "public"."enum_pages_blocks_hero_variant";
  DROP TYPE "public"."enum_pages_blocks_hero_scheme";
  DROP TYPE "public"."enum_pages_blocks_hero_media_side";
  DROP TYPE "public"."enum_pages_blocks_hero_text_align";
  DROP TYPE "public"."enum_pages_blocks_hero_vertical_align";
  DROP TYPE "public"."enum_pages_blocks_hero_overlay";
  DROP TYPE "public"."enum_pages_blocks_hero_min_height";
  DROP TYPE "public"."enum_pages_blocks_product_grid_variant";
  DROP TYPE "public"."enum_pages_blocks_product_grid_columns";
  DROP TYPE "public"."enum_pages_blocks_product_grid_source";
  DROP TYPE "public"."enum_pages_blocks_image_gallery_columns";
  DROP TYPE "public"."enum_pages_blocks_split_hero_variant";
  DROP TYPE "public"."enum_pages_blocks_split_hero_text_align";
  DROP TYPE "public"."enum_pages_blocks_split_hero_overlay_vertical_align";
  DROP TYPE "public"."enum_pages_blocks_spacer_variant";
  DROP TYPE "public"."enum_pages_blocks_spacer_size";
  DROP TYPE "public"."enum_pages_blocks_feature_grid_items_icon";
  DROP TYPE "public"."enum_pages_blocks_feature_grid_variant";
  DROP TYPE "public"."enum_pages_blocks_feature_grid_columns";
  DROP TYPE "public"."enum_pages_blocks_steps_variant";
  DROP TYPE "public"."enum_pages_blocks_logo_strip_variant";
  DROP TYPE "public"."enum_pages_blocks_video_embed_variant";
  DROP TYPE "public"."enum_pages_blocks_video_embed_provider";
  DROP TYPE "public"."enum_pages_blocks_contact_variant";
  DROP TYPE "public"."enum_pages_blocks_featured_product_variant";
  DROP TYPE "public"."enum_pages_blocks_incentives_items_icon";
  DROP TYPE "public"."enum_pages_blocks_incentives_columns";
  DROP TYPE "public"."enum_pages_blocks_category_previews_variant";
  DROP TYPE "public"."enum_pages_blocks_category_previews_source";
  DROP TYPE "public"."enum_pages_blocks_promo_section_variant";
  DROP TYPE "public"."enum_pages_blocks_reviews_variant";
  DROP TYPE "public"."enum_pages_blocks_media_hero_variant";
  DROP TYPE "public"."enum_pages_blocks_media_hero_text_align";
  DROP TYPE "public"."enum_pages_blocks_media_hero_vertical_align";
  DROP TYPE "public"."enum_pages_blocks_media_hero_overlay";
  DROP TYPE "public"."enum_pages_blocks_media_hero_min_height";
  DROP TYPE "public"."enum_pages_blocks_ticker_variant";
  DROP TYPE "public"."enum_pages_blocks_story_stats_variant";
  DROP TYPE "public"."enum_pages_blocks_custom_section_scheme";
  DROP TYPE "public"."enum_pages_aeo_schema_type";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_blocks_hero_floating_cards_corner";
  DROP TYPE "public"."enum__pages_v_blocks_hero_variant";
  DROP TYPE "public"."enum__pages_v_blocks_hero_scheme";
  DROP TYPE "public"."enum__pages_v_blocks_hero_media_side";
  DROP TYPE "public"."enum__pages_v_blocks_hero_text_align";
  DROP TYPE "public"."enum__pages_v_blocks_hero_vertical_align";
  DROP TYPE "public"."enum__pages_v_blocks_hero_overlay";
  DROP TYPE "public"."enum__pages_v_blocks_hero_min_height";
  DROP TYPE "public"."enum__pages_v_blocks_product_grid_variant";
  DROP TYPE "public"."enum__pages_v_blocks_product_grid_columns";
  DROP TYPE "public"."enum__pages_v_blocks_product_grid_source";
  DROP TYPE "public"."enum__pages_v_blocks_image_gallery_columns";
  DROP TYPE "public"."enum__pages_v_blocks_split_hero_variant";
  DROP TYPE "public"."enum__pages_v_blocks_split_hero_text_align";
  DROP TYPE "public"."enum__pages_v_blocks_split_hero_overlay_vertical_align";
  DROP TYPE "public"."enum__pages_v_blocks_spacer_variant";
  DROP TYPE "public"."enum__pages_v_blocks_spacer_size";
  DROP TYPE "public"."enum__pages_v_blocks_feature_grid_items_icon";
  DROP TYPE "public"."enum__pages_v_blocks_feature_grid_variant";
  DROP TYPE "public"."enum__pages_v_blocks_feature_grid_columns";
  DROP TYPE "public"."enum__pages_v_blocks_steps_variant";
  DROP TYPE "public"."enum__pages_v_blocks_logo_strip_variant";
  DROP TYPE "public"."enum__pages_v_blocks_video_embed_variant";
  DROP TYPE "public"."enum__pages_v_blocks_video_embed_provider";
  DROP TYPE "public"."enum__pages_v_blocks_contact_variant";
  DROP TYPE "public"."enum__pages_v_blocks_featured_product_variant";
  DROP TYPE "public"."enum__pages_v_blocks_incentives_items_icon";
  DROP TYPE "public"."enum__pages_v_blocks_incentives_columns";
  DROP TYPE "public"."enum__pages_v_blocks_category_previews_variant";
  DROP TYPE "public"."enum__pages_v_blocks_category_previews_source";
  DROP TYPE "public"."enum__pages_v_blocks_promo_section_variant";
  DROP TYPE "public"."enum__pages_v_blocks_reviews_variant";
  DROP TYPE "public"."enum__pages_v_blocks_media_hero_variant";
  DROP TYPE "public"."enum__pages_v_blocks_media_hero_text_align";
  DROP TYPE "public"."enum__pages_v_blocks_media_hero_vertical_align";
  DROP TYPE "public"."enum__pages_v_blocks_media_hero_overlay";
  DROP TYPE "public"."enum__pages_v_blocks_media_hero_min_height";
  DROP TYPE "public"."enum__pages_v_blocks_ticker_variant";
  DROP TYPE "public"."enum__pages_v_blocks_story_stats_variant";
  DROP TYPE "public"."enum__pages_v_blocks_custom_section_scheme";
  DROP TYPE "public"."enum__pages_v_version_aeo_schema_type";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_store_settings_currency";
  DROP TYPE "public"."enum_store_settings_theme_heading_weight";
  DROP TYPE "public"."enum_store_settings_theme_body_weight";
  DROP TYPE "public"."enum_store_settings_theme_button_radius";
  DROP TYPE "public"."enum_store_settings_header_layout";
  DROP TYPE "public"."enum_store_settings_logo_size";
  DROP TYPE "public"."enum_section_definitions_status";
  DROP TYPE "public"."enum__section_definitions_v_version_status";
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_import_items_warnings";
  DROP TYPE "public"."enum_import_items_status";
  DROP TYPE "public"."enum_gateway_configs_environment";
  DROP TYPE "public"."enum_payment_attempts_status";
  DROP TYPE "public"."enum_payment_gateway_requests_status";`)
}
