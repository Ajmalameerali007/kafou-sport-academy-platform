begin;
select plan(4);
select has_table('public','academy_classes','Recurring classes exist');
select has_table('public','class_sessions','Dated sessions exist');
select has_table('public','session_roster','Roster is persisted');
select has_function('public','operations_command',array['text','jsonb'],'Transactional operational commands exist');
select * from finish();
rollback;
