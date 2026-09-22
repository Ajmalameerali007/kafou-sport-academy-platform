-- Staging configuration only: no operational venues, classes or people.
insert into public.organizations(slug,name) values('kafou','KAFOU Sport Academy') on conflict(slug) do nothing;
insert into public.branches(slug,name,name_ar,area,provisional) values
('dubai','Dubai','دبي','Dubai',true),('sharjah','Sharjah','الشارقة','Sharjah',true),('ajman','Ajman','عجمان','Ajman',true),
('dxb-2','DXB 2','دبي ٢','Dubai',true),('dxb-3','DXB 3','دبي ٣','Dubai',true),('shj-2','SHJ 2','الشارقة ٢','Sharjah',true),('ajm-2','AJM 2','عجمان ٢','Ajman',true)
on conflict(slug) do nothing;
