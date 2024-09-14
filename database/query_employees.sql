select 
				e.id,
				e.employee_code,
                coalesce( e.fname, ' ') || ' ' || coalesce( e.lname, ' ' ) as full_name,
                e.phone,
                dg.department_group,
				e.birth_date,
                g.gender,
                em.email,
                e.address,
				t.name_th as tambons,
				am.name_th as amphures,
				p.name_th as provinces,
				cn.name_company,
                s.status
                FROM
                    employees e
                left join department_groups dg on e.id_department_group = dg.id
                left join genders g on e.id_gender = g.id
				left join emails em on e.id_email = em.id
				left join companies cn on e.id_company = cn.id
				left join thai_provinces p on e.id_provinces = p.id
				left join thai_amphures am on e.id_amphures = am.id
				left join thai_tambons t on e.id_tambons = t.id
				left join status s on e.id_status = s.id
				order by id asc;