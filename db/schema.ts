import {sql} from 'drizzle-orm';
import {sqliteTable,text,integer,uniqueIndex,index,check} from 'drizzle-orm/sqlite-core';

export const companies=sqliteTable('companies',{
  id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),
  profileType:text('profile_type').notNull().default('pj'),
  opening:integer('opening').notNull(),openingDate:text('opening_date').notNull(),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('idx_companies_owner').on(t.owner),check('company_opening_integer',sql`typeof(${t.opening}) = 'integer' AND abs(${t.opening}) <= 99999999999`)]);

export const entries=sqliteTable('entries',{
  id:text('id').primaryKey(),companyId:text('company_id').notNull().references(()=>companies.id),
  type:text('type').notNull(),description:text('description').notNull(),party:text('party').notNull(),category:text('category').notNull(),
  amount:integer('amount').notNull(),due:text('due').notNull(),paid:text('paid'),createdAt:text('created_at').notNull(),paidAt:text('paid_at'),
  installmentGroup:text('installment_group'),installment:integer('installment').notNull().default(1),installmentCount:integer('installment_count').notNull().default(1),requestKey:text('request_key'),
  revision:integer('revision').notNull().default(0),updatedBy:text('updated_by'),changeReason:text('change_reason'),lastMutationId:text('last_mutation_id'),lastMutationKey:text('last_mutation_key'),
},t=>[index('idx_entries_company_due').on(t.companyId,t.due),index('idx_entries_company_group').on(t.companyId,t.installmentGroup),check('entry_type',sql`${t.type} IN ('in','out')`),check('entry_amount_integer',sql`typeof(${t.amount}) = 'integer' AND ${t.amount} BETWEEN 1 AND 99999999999`)]);

export const entryHistory=sqliteTable('entry_history',{
  id:integer('id').primaryKey({autoIncrement:true}),entryId:text('entry_id').notNull().references(()=>entries.id),companyId:text('company_id').notNull().references(()=>companies.id),
  action:text('action').notNull(),actor:text('actor').notNull(),reason:text('reason').notNull(),beforeJson:text('before_json'),afterJson:text('after_json').notNull(),occurredAt:text('occurred_at').notNull(),
},t=>[index('idx_history_company_entry').on(t.companyId,t.entryId,t.id)]);

export const investments=sqliteTable('investments',{
 id:text('id').primaryKey(),companyId:text('company_id').notNull().references(()=>companies.id),data:text('data').notNull(),revision:integer('revision').notNull().default(0),updatedAt:text('updated_at').notNull(),
},t=>[index('idx_investments_company').on(t.companyId)]);

export const members=sqliteTable('members',{
 userId:text('user_id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),validUntil:text('valid_until'),revision:integer('revision').notNull().default(0),requestedAt:text('requested_at').notNull(),updatedAt:text('updated_at').notNull(),
});
export const billingSettings=sqliteTable('billing_settings',{
 id:integer('id').primaryKey(),checkoutUrl:text('checkout_url').notNull(),supportEmail:text('support_email').notNull(),updatedAt:text('updated_at').notNull(),
});
export const membershipEvents=sqliteTable('membership_events',{
 id:integer('id').primaryKey({autoIncrement:true}),userId:text('user_id').notNull().references(()=>members.userId),actor:text('actor').notNull(),validUntil:text('valid_until'),reason:text('reason').notNull(),paymentRef:text('payment_ref').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('idx_membership_events_user').on(t.userId)]);
