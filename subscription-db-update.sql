-- PostgreSQL subscription system tables for Social Genius
-- Run this script to add the subscription and payment system to your database

-- Create subscription_plans table to store plan details
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  plan_id TEXT UNIQUE NOT NULL,
  helcim_plan_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price NUMERIC(10, 2) NOT NULL,
  annual_price NUMERIC(10, 2) NOT NULL,
  min_locations INTEGER NOT NULL DEFAULT 1,
  max_locations INTEGER,
  features JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create payment_customers table to link users with payment processor
CREATE TABLE IF NOT EXISTS payment_customers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  helcim_customer_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  phone TEXT,
  address JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, helcim_customer_id)
);

-- Create subscriptions table to track user subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  helcim_subscription_id TEXT UNIQUE NOT NULL,
  helcim_customer_id TEXT NOT NULL,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active',
  quantity INTEGER NOT NULL DEFAULT 1,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create payment_methods table to store tokenized payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  helcim_customer_id TEXT NOT NULL,
  helcim_payment_method_id TEXT UNIQUE NOT NULL,
  card_type TEXT,
  last_four TEXT,
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create payments table to track payment history
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  helcim_transaction_id TEXT UNIQUE NOT NULL,
  helcim_subscription_id TEXT,
  helcim_customer_id TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  description TEXT,
  failure_reason TEXT,
  payment_method_id INTEGER REFERENCES payment_methods(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add subscription_id to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS subscription_plans_plan_id_idx 
ON subscription_plans(plan_id);

CREATE INDEX IF NOT EXISTS payment_customers_user_id_idx 
ON payment_customers(user_id);

CREATE INDEX IF NOT EXISTS payment_customers_helcim_customer_id_idx 
ON payment_customers(helcim_customer_id);

CREATE INDEX IF NOT EXISTS subscriptions_business_id_idx 
ON subscriptions(business_id);

CREATE INDEX IF NOT EXISTS subscriptions_helcim_subscription_id_idx 
ON subscriptions(helcim_subscription_id);

CREATE INDEX IF NOT EXISTS payments_helcim_subscription_id_idx 
ON payments(helcim_subscription_id);

CREATE INDEX IF NOT EXISTS payments_helcim_customer_id_idx 
ON payments(helcim_customer_id);

-- Insert initial subscription plans
INSERT INTO subscription_plans (
  plan_id, 
  helcim_plan_id, 
  name, 
  description, 
  monthly_price, 
  annual_price, 
  min_locations, 
  max_locations, 
  features
) VALUES 
(
  'basic',
  'hlm_plan_basic',
  'Basic',
  'Perfect for agencies managing a few locations',
  199.00,
  179.00,
  1,
  10,
  '[
    {"name": "AI-Driven Post Creation", "included": true},
    {"name": "Review Response Automation", "included": true},
    {"name": "Basic Analytics", "included": true},
    {"name": "Multi-Location Dashboard", "included": true},
    {"name": "Posts per month", "included": true, "limit": 4},
    {"name": "Review responses", "included": true, "limit": "100/mo"},
    {"name": "Team members", "included": true, "limit": 2},
    {"name": "White-label reports", "included": false},
    {"name": "Competitor analysis", "included": false},
    {"name": "Priority support", "included": false}
  ]'::jsonb
),
(
  'professional',
  'hlm_plan_professional',
  'Professional',
  'Ideal for growing agencies',
  169.00,
  149.00,
  11,
  50,
  '[
    {"name": "AI-Driven Post Creation", "included": true},
    {"name": "Review Response Automation", "included": true},
    {"name": "Basic Analytics", "included": true},
    {"name": "Multi-Location Dashboard", "included": true},
    {"name": "Posts per month", "included": true, "limit": 8},
    {"name": "Review responses", "included": true, "limit": "500/mo"},
    {"name": "Team members", "included": true, "limit": 5},
    {"name": "White-label reports", "included": true},
    {"name": "Competitor analysis", "included": true, "limit": "Basic"},
    {"name": "Priority support", "included": true}
  ]'::jsonb
),
(
  'business',
  'hlm_plan_business',
  'Business',
  'For established agencies with multiple locations',
  119.00,
  99.00,
  51,
  250,
  '[
    {"name": "AI-Driven Post Creation", "included": true},
    {"name": "Review Response Automation", "included": true},
    {"name": "Basic Analytics", "included": true},
    {"name": "Multi-Location Dashboard", "included": true},
    {"name": "Posts per month", "included": true, "limit": 12},
    {"name": "Review responses", "included": true, "limit": "Unlimited"},
    {"name": "Team members", "included": true, "limit": "Unlimited"},
    {"name": "White-label reports", "included": true},
    {"name": "Competitor analysis", "included": true, "limit": "Advanced"},
    {"name": "Priority support", "included": true},
    {"name": "Dedicated account manager", "included": true}
  ]'::jsonb
),
(
  'enterprise',
  'hlm_plan_enterprise',
  'Enterprise',
  'Custom solutions for large-scale agencies',
  0.00,
  0.00,
  251,
  NULL,
  '[
    {"name": "AI-Driven Post Creation", "included": true},
    {"name": "Review Response Automation", "included": true},
    {"name": "Basic Analytics", "included": true},
    {"name": "Multi-Location Dashboard", "included": true},
    {"name": "Posts per month", "included": true, "limit": "Custom"},
    {"name": "Review responses", "included": true, "limit": "Unlimited"},
    {"name": "Team members", "included": true, "limit": "Unlimited"},
    {"name": "White-label reports", "included": true},
    {"name": "Competitor analysis", "included": true, "limit": "Enterprise"},
    {"name": "Priority support", "included": true},
    {"name": "Dedicated account manager", "included": true},
    {"name": "Custom integrations", "included": true},
    {"name": "API access", "included": true}
  ]'::jsonb
) 
ON CONFLICT (plan_id) DO NOTHING;

-- Create or replace function to update timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at column
CREATE TRIGGER update_subscription_plans_modtime
BEFORE UPDATE ON subscription_plans
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_payment_customers_modtime
BEFORE UPDATE ON payment_customers
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_subscriptions_modtime
BEFORE UPDATE ON subscriptions
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_payment_methods_modtime
BEFORE UPDATE ON payment_methods
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();