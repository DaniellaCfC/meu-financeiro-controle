CREATE TRIGGER entries_history_created AFTER INSERT ON entries BEGIN
 INSERT INTO entry_history (entry_id,company_id,action,actor,reason,before_json,after_json,occurred_at)
 VALUES (NEW.id,NEW.company_id,'created',COALESCE(NEW.updated_by,(SELECT owner FROM companies WHERE id=NEW.company_id)),'Lançamento criado',NULL,json_object('type',NEW.type,'description',NEW.description,'party',NEW.party,'category',NEW.category,'amount',NEW.amount,'due',NEW.due,'paid',NEW.paid,'revision',NEW.revision,'installment',NEW.installment,'installmentCount',NEW.installment_count),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER entries_history_updated AFTER UPDATE ON entries BEGIN
 INSERT INTO entry_history (entry_id,company_id,action,actor,reason,before_json,after_json,occurred_at)
 VALUES (NEW.id,NEW.company_id,CASE WHEN OLD.paid IS NULL AND NEW.paid IS NOT NULL THEN 'settled' WHEN OLD.paid IS NOT NULL AND NEW.paid IS NULL THEN 'reopened' ELSE 'edited' END,COALESCE(NEW.updated_by,(SELECT owner FROM companies WHERE id=NEW.company_id)),COALESCE(NEW.change_reason,'Lançamento atualizado'),json_object('type',OLD.type,'description',OLD.description,'party',OLD.party,'category',OLD.category,'amount',OLD.amount,'due',OLD.due,'paid',OLD.paid,'revision',OLD.revision,'installment',OLD.installment,'installmentCount',OLD.installment_count),json_object('type',NEW.type,'description',NEW.description,'party',NEW.party,'category',NEW.category,'amount',NEW.amount,'due',NEW.due,'paid',NEW.paid,'revision',NEW.revision,'installment',NEW.installment,'installmentCount',NEW.installment_count),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
