select
		m.id,
		m.name_mat,
		u.unit_name,
		mg.name_group,
		m.code_mat,
		m.price_delivery,
		m.price_station,
		m.price_factory,
		m.ghg,
		m.standard_weight,
		s.status
from
	materials m
	
	left join group_materials mg on m.id_mat_group = mg.id 
	left join units u on m.id_unit = u.id
	left join status s on m.id_status = s.id
		