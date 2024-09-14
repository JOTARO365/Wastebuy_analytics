SELECT 
                c.id,
                c.username,
                coalesce( c.fname, ' ') || ' ' || coalesce( c.lname, ' ' ) as full_name,
                c.phone,
                cg.customer_group,
                g.gender,
                em.email,
                c.address,
             	c.id_company,
				case
					when t.name_th is not null then t.name_th
				else
					case
						when c.address like '%ตำบล%' then 'ตำบล'
						when c.address like '%แขวง%' then 'แขวง'
						else null
					end
				end as tambons,
				case
					when am.name_th is not null then am.name_th
				else
					case 
						when c.address like '%เขต%' then 'เขต'
						when c.address like '%อำเภอ%' then 'อำเภอ'
						else null
					end
				end as amphures,
                case
					when p.name_th is not null then p.name_th
				else
					lp.province_name
				end as provinces,
                s.status,
                c.regis_date
                FROM
                    customers c
                left join customer_groups cg on c.id_customer = cg.id
                left join genders g on c.id_gender = g.id
				left join emails em on c.id_email = em.id
				left join companies cm on c.id_company = cm.id
				left join thai_provinces p on c.id_provinces = p.id
				left join thai_amphures am on c.id_amphures = am.id
				left join thai_tambons t on c.id_tambons = t.id
				left join status s on c.id_status = s.id
				left join lookup_provinces lp on c.address like '%' || id_search ||'%'
				order by id asc;