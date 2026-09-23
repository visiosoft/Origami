/**
 * Subcontractor trades: the CSLB contractor licence classifications
 * (A General Engineering, B General Building, C specialty trades and the
 * C-61 / D limited specialties), from 'Sub-Contractor License Classifications.xlsx'.
 * Seeded once; admins edit the list afterwards.
 */
export const DEFAULT_SUBCONTRACTOR_TRADES = [
  {
    "id": "SCT-A",
    "code": "A",
    "name": "General Engineering",
    "category": "general_engineering",
    "description": "A general engineering contractor is a contractor whose principal contracting business is in connection with fixed works requiring specialized engineering knowledge and skill, including the following divisions or subjects: irrigation, drainage, water power, water supply, flood control, inland water ways, harbors, docks and wharves, shipyards and ports, dams and hydroelectric projects, levees, river control and reclamation works, railroads, highways, streets and roads, tunnels, airports and airways, sewers and sewage disposal plants and systems, waste reduction plants, bridges, overpasses, underpasses and other similar works, pipelines and other systems for the transmission of petroleum and other liquids or gaseous substances, parks, playgrounds and other recreational works, refineries, chemical plants and similar industrial plants requiring specialized engineering knowledge and skill, powerhouses, power plants and other utilities plants and installations, mines and metallurgical plants, land leveling and earthmoving projects, excavating, grading, trenching, paving and surfacing work, and cement and concrete works in connection with the above mentioned fixed works. (BPC §7056)",
    "active": true,
    "order": 0
  },
  {
    "id": "SCT-B",
    "code": "B",
    "name": "General Building",
    "category": "general_building",
    "description": "(a) A general building contractor’s principal contracting business is in whole or partial connection with any structure built, being built, or to be built, for the support, shelter and enclosure of persons, animals, chattels, or moveable property of any kind requiring in its construction the use of at least two unrelated building trades or crafts, or to superintend the whole or any part thereof. This does not include anyone who merely furnishes materials or supplies under Section 7045 without fabricating them into, or consuming them in the performance of the work of the general building contractor.\n(b) A general building contractor may take a prime contract or a subcontract for a framing or carpentry project. However, a general building contractor shall not take a prime contract for any project involving trades other than framing or carpentry unless the prime contract requires at least two unrelated building trades or crafts other than framing or carpentry, or unless the general building contractor holds the appropriate license classification or subcontracts with an appropriately licensed contractor to perform the work. A general building contractor shall not take a subcontract involving trades other than framing or carpentry, unless the subcontract requires at least two unrelated trades or crafts other than framing or carpentry, or unless the general building contractor holds the appropriate license classification. The general building contractor may not count framing or carpentry in calculating the two unrelated trades necessary in order for the general building contractor to be able to take a prime contract or subcontract for a project involving other trades.\n(c) No general building contractor shall contract for any project that includes the “C-16” Fire Protection classification as provided for in Section 7026.12 or the “C-57” Well Drilling classification as provided for in Section 13750.5 of the Water Code, unless the general building contractor holds the appropriate license classification, or subcontracts with the appropriately licensed contractor. (BPC §7057)",
    "active": true,
    "order": 1
  },
  {
    "id": "SCT-C-2",
    "code": "C-2",
    "name": "Insulation and Acoustical",
    "category": "specialty",
    "description": "An insulation and acoustical contractor installs any insulating media and preformed architectural acoustical materials for the purpose of temperature and/or sound control. (832.02 CCR)",
    "active": true,
    "order": 2
  },
  {
    "id": "SCT-C-4",
    "code": "C-4",
    "name": "Boiler, Hot-Water Heating and Steam Fitting",
    "category": "specialty",
    "description": "A boiler, hot-water heating and steam fitting contractor installs, services and repairs power boiler installations, hot-water heating systems and steam fitting, including firetube and water-tube steel power boilers and hot-water heating low pressure boilers, steam fitting and piping, fittings, valves, gauges, pumps, radiators, convectors, fuel oil tanks, fuel oil lines, chimneys, flues, heat insulation and all other equipment, including solar heating equipment, associated with these systems. (832.04 CCR)",
    "active": true,
    "order": 3
  },
  {
    "id": "SCT-C-5",
    "code": "C-5",
    "name": "Framing and Rough Carpentry",
    "category": "specialty",
    "description": "A framing and rough carpentry contractor performs any form work, framing or rough carpentry necessary to construct framed structures; installs or repairs individual components of framing systems and performs any rough carpentry or associated work, including but not limited to the construction or installation of: sub-flooring, siding, exterior staircases and railings, overhead doors, roof decking, truss members, and sheathing. (832.05 CCR)",
    "active": true,
    "order": 4
  },
  {
    "id": "SCT-C-6",
    "code": "C-6",
    "name": "Cabinet, Millwork and Finish Carpentry",
    "category": "specialty",
    "description": "A cabinet, millwork and finish carpentry contractor makes cabinets, cases, sashes, doors, trims, non-bearing partitions and other items of “finish carpentry” by cutting, surfacing, joining, gluing and fabricating wood or other products to provide a functional surface. This contractor also places, erects, and finishes such cabinets and millwork in structures. (832.06 CCR)",
    "active": true,
    "order": 5
  },
  {
    "id": "SCT-C-7",
    "code": "C-7",
    "name": "Low Voltage Systems",
    "category": "specialty",
    "description": "A communication and low voltage systems contractor installs, services and maintains all types of communication and low voltage systems which are energy limited and do not exceed 91 volts. These systems include, but are not limited to, telephone systems, sound systems, cable television systems, closed-circuit video systems, satellite dish antennas, instrumentation and temperature controls, and low voltage landscape lighting. Low voltage fire alarm systems are specifically not included in this section. (832.07 CCR)",
    "active": true,
    "order": 6
  },
  {
    "id": "SCT-C-8",
    "code": "C-8",
    "name": "Concrete",
    "category": "specialty",
    "description": "A concrete contractor forms, pours, places, finishes and installs specified mass, pavement, flat and other concrete work; and places and sets screeds for pavements or flatwork. This class shall not include contractors whose sole contracting business is the application of plaster coatings or placing and erecting of steel or bars for the reinforcing of mass, pavement, flat and other concrete work. (832.08 CCR)",
    "active": true,
    "order": 7
  },
  {
    "id": "SCT-C-9",
    "code": "C-9",
    "name": "Drywall",
    "category": "specialty",
    "description": "A drywall contractor lays out and installs gypsum wall board and gypsum wall board assemblies, including nonstructural metal framing members, and performs the taping and texturing operations including the application of compounds that adhere to wall board to produce a continuous smooth or textured surface. (832.09 CCR)",
    "active": true,
    "order": 8
  },
  {
    "id": "SCT-C-10",
    "code": "C-10",
    "name": "Electrical",
    "category": "specialty",
    "description": "An electrical contractor places, installs, erects or connects any electrical wires, fixtures, appliances, apparatus, raceways, conduits, solar photovoltaic cells or any part thereof, which generate, transmit, transform or utilize electrical energy in any form or for any purpose. (832.10 CCR)",
    "active": true,
    "order": 9
  },
  {
    "id": "SCT-C-11",
    "code": "C-11",
    "name": "Elevator",
    "category": "specialty",
    "description": "An elevator contractor fabricates, erects, installs and repairs elevators, including sheave beams, motors, sheaves, cable and wire rope, guides, cab, counter weights, doors (including sidewalk elevator doors), automatic and manual controls, signal systems, and all other devices and equipment associated with the safe and efficient installation and operation of electrical, hydraulic and manually operated elevators. (832.11 CCR)",
    "active": true,
    "order": 10
  },
  {
    "id": "SCT-C-12",
    "code": "C-12",
    "name": "Earthwork and Paving",
    "category": "specialty",
    "description": "An earthwork and paving contractor digs, moves, and places material forming the surface of the earth, other than water, in such a manner that a cut, fill, excavation, grade, trench, backfill, or tunnel (if incidental thereto) can be executed, including the use of explosives for these purposes. This classification includes the mixing, fabricating and placing of paving and any other surfacing materials. (832.12 CCR)",
    "active": true,
    "order": 11
  },
  {
    "id": "SCT-C-13",
    "code": "C-13",
    "name": "Fencing",
    "category": "specialty",
    "description": "A fencing contractor constructs, erects, alters, or repairs all types of fences, corrals, runs, railings, cribs, game court enclosures, guard rails and barriers, playground game equipment, backstops, posts, flagpoles, and gates, excluding masonry walls. (832.13 CCR)",
    "active": true,
    "order": 12
  },
  {
    "id": "SCT-C-15",
    "code": "C-15",
    "name": "Flooring and Floor Covering",
    "category": "specialty",
    "description": "A flooring and floor covering contractor prepares any surface for the installation of flooring and floor coverings, and installs carpet, resilient sheet goods, resilient tile, wood floors and flooring (including the finishing and repairing thereof), and any other materials established as flooring and floor covering material, except ceramic tile. (832.15 CCR)",
    "active": true,
    "order": 13
  },
  {
    "id": "SCT-C-16",
    "code": "C-16",
    "name": "Fire Protection",
    "category": "specialty",
    "description": "A fire protection contractor lays out, fabricates and installs all types of fire protection systems; including all the equipment associated with these systems, excluding electrical alarm systems. (832.16 CCR)",
    "active": true,
    "order": 14
  },
  {
    "id": "SCT-C-17",
    "code": "C-17",
    "name": "Glazing",
    "category": "specialty",
    "description": "A glazing contractor selects, cuts, assembles and/or installs all makes and kinds of glass, glass work, mirrored glass, and glass substitute materials for glazing; executes the fabrication and glazing of frames, panels, sashes and doors; and/or installs these items in any structure. (832.17 CCR)",
    "active": true,
    "order": 15
  },
  {
    "id": "SCT-C-20",
    "code": "C-20",
    "name": "Warm-Air Heating, Ventilating and Air-Conditioning",
    "category": "specialty",
    "description": "A warm-air heating, ventilating and air-conditioning contractor fabricates, installs, maintains, services and repairs warm-air heating systems and water heating heat pumps, complete with warm-air appliances; ventilating systems complete with blowers and plenum chambers; air-conditioning systems complete with air-conditioning unit; and the ducts, registers, flues, humidity and thermostatic controls and air filters in connection with any of these systems. This classification shall include warm-air heating, ventilating and air-conditioning systems which utilize solar energy. (832.20 CCR)",
    "active": true,
    "order": 16
  },
  {
    "id": "SCT-C-21",
    "code": "C-21",
    "name": "Building Moving/Demolition",
    "category": "specialty",
    "description": "A building moving/demolition contractor raises, lowers, cribs, underpins, demolishes and moves or removes structures, including their foundations. This classification does not include the alterations, additions, repairs or rehabilitation of the permanently retained portions of such structures. (832.21 CCR)",
    "active": true,
    "order": 17
  },
  {
    "id": "SCT-C-22",
    "code": "C-22",
    "name": "Asbestos Abatement",
    "category": "specialty",
    "description": "An asbestos abatement contractor performs abatement, including containment, encapsulation, or removal, and disposal of asbestos-containing construction materials, as defined in Section 6501.8 of the Labor Code, in and on buildings and structures. All work performed and all documentation prepared by an asbestos abatement contractor shall be done in accordance with regulations and requirements of the Department of Industrial Relations’ Division of Occupational Safety and Health (DOSH). The C-22 Asbestos Abatement contractor classification operates as a stand-alone specialty contractor classification for asbestos abatement work, regardless of any other classification(s) that may be held by the licensed contractor, and functions within the scope of the contractor’s DOSH registration. (832.22 and 833 CCR excerpts)",
    "active": true,
    "order": 18
  },
  {
    "id": "SCT-C-23",
    "code": "C-23",
    "name": "Ornamental Metal",
    "category": "specialty",
    "description": "An ornamental metals contractor assembles, casts, cuts, shapes, stamps, forges, welds, fabricates and installs, sheet, rolled and cast, brass, bronze, copper, cast iron, wrought iron, monel metal, stainless steel, steel, and/or any other metal for the architectural treatment and ornamental decoration of structures. This classification does not include the work of a sheet metal contractor. (832.23 CCR)",
    "active": true,
    "order": 19
  },
  {
    "id": "SCT-C-27",
    "code": "C-27",
    "name": "Landscaping",
    "category": "specialty",
    "description": "A landscape contractor constructs, maintains, repairs, installs, or subcontracts the development of landscape systems and facilities for public and private gardens and other areas which are designed to aesthetically, architecturally, horticulturally, or functionally improve the grounds within or surrounding a structure, or a tract or plot of land. In connection therewith, a landscape contractor prepares and grades plots and areas of land for the installation of any architectural, horticultural and decorative treatment or arrangement. (832.27 CCR)",
    "active": true,
    "order": 20
  },
  {
    "id": "SCT-C-28",
    "code": "C-28",
    "name": "Lock and Security Equipment",
    "category": "specialty",
    "description": "A lock and security equipment contractor evaluates, sets-up, installs, maintains and repairs all doors and door assemblies, gates, locks and locking devices, panic and fire rated exit devices, manual and automatic operated gate and door closures and releases, jail and prison locking devices and permanently installed or built-in safes and vaults. This classification includes but is not limited to master key systems, metal window guards, security doors, card activated and electronic access control systems for control equipment, motion and other types of detectors and computer systems for control and audit of control systems and other associated equipment. Fire alarm systems are specifically not included in this section. (832.28 CCR)",
    "active": true,
    "order": 21
  },
  {
    "id": "SCT-C-29",
    "code": "C-29",
    "name": "Masonry",
    "category": "specialty",
    "description": "A masonry contractor installs concrete units and baked clay products; concrete, glass and clay block; natural and manufactured stone; terra cotta; and fire brick or other material for refractory work. This classification includes the fabrication and installation of masonry component units for structural load bearing and non-load bearing walls for structures and fences installed with or without mortar; ceramic veneer (not tile) and thin brick that resembles full brick for facing; paving; and clear waterproofing, cleaning and caulking incidental to masonry construction. (832.29 CCR)",
    "active": true,
    "order": 22
  },
  {
    "id": "SCT-C-31",
    "code": "C-31",
    "name": "Construction Zone Traffic Control",
    "category": "specialty",
    "description": "A construction zone traffic control contractor prepares or removes lane closures, flagging, or traffic diversions, utilizing portable devices, such as cones, delineators, barricades, sign stands, flashing beacons, flashing arrow trailers, and changeable message signs, on roadways, including, but not limited to, public streets, highways, or any public conveyance. (832.31 CCR)",
    "active": true,
    "order": 23
  },
  {
    "id": "SCT-C-32",
    "code": "C-32",
    "name": "Parking and Highway Improvement",
    "category": "specialty",
    "description": "A parking and highway improvement contractor applies and installs protective coatings, vehicle stops, guard rails and mechanical devices, directional lines, buttons, markers, signs and arrows on the horizontal surface of any game court, parking facility, airport, highway or roadway constructed of concrete, asphalt or similar material. This classification includes the surface preparatory work necessary for the application of protective coatings but does not include the re-paving of these surfaces. (832.32 CCR)",
    "active": true,
    "order": 24
  },
  {
    "id": "SCT-C-33",
    "code": "C-33",
    "name": "Painting and Decorating",
    "category": "specialty",
    "description": "A painting and decorating contractor prepares by scraping, sandblasting or other means and applies any of the following: paints, papers, textures, fabrics, pigments, oils, turpentines, japans, driers, thinners, varnishes, shellacs, stains, fillers, waxes, adhesives, water and any other vehicles, mediums and materials which adhere by evaporation and may be mixed, used and applied to the surfaces of structures and the appurtenances thereto for purposes of decorating, protecting, fireproofing and waterproofing. (832.33 CCR)",
    "active": true,
    "order": 25
  },
  {
    "id": "SCT-C-34",
    "code": "C-34",
    "name": "Pipeline",
    "category": "specialty",
    "description": "A pipeline contractor fabricates and installs pipelines for the conveyance of fluids, such as water, gas, or petroleum, or for the containment or protection of any other material, including the application of protective coatings or systems and the trenching, boring, shoring, backfilling, compacting, paving and surfacing necessary to complete the installation of such pipelines. (832.34 CCR)",
    "active": true,
    "order": 26
  },
  {
    "id": "SCT-C-35",
    "code": "C-35",
    "name": "Lathing and Plastering",
    "category": "specialty",
    "description": "(a) A lathing and plastering contractor coats surfaces with a mixture of sand, gypsum plaster, quick-lime or hydrated lime and water, or sand and cement and water, or a combination of such other materials that create a permanent coating, including coatings for the purpose of soundproofing and fireproofing. These coatings are applied with a plasterer’s trowel or sprayed over any surface which offers a mechanical means for the support of such coating, and will adhere by suction. This contractor also installs lath (including metal studs) or any other material prepared or manufactured to provide a base or bond for such coating.\n(b) A lathing and plastering contractor also applies and affixes wood and metal lath, or any other material prepared or manufactured to provide key or suction bases for the support of plaster coatings. This classification includes the channel work and metal studs for the support of metal or any other lathing material and for solid plaster partitions. (832.35 CCR)",
    "active": true,
    "order": 27
  },
  {
    "id": "SCT-C-36",
    "code": "C-36",
    "name": "Plumbing",
    "category": "specialty",
    "description": "A plumbing contractor provides a means for a supply of safe water, ample in volume and of suitable temperature for the purpose intended and the proper disposal of fluid waste from the premises in all structures and fixed works. This classification includes but is not limited to:\n(a) Complete removal of waste from the premises or the construction and connection of on-site waste disposal systems;\n(b) Piping, storage tanks and venting for a safe and adequate supply of gases and liquids for any purpose, including vacuum, compressed air and gases for medical, dental, commercial and industrial uses;\n(c) All gas appliances, flues and gas connections for all systems including suspended space heating units. (This does not include forced warm air units.);\n(d) Water and gas piping from the property owner’s side of the utility meter to the structure or fixed works; (e) Installation of any type of equipment to heat water or fluids, to a temperature suitable for the purposes listed in this section, including the installation of solar equipment for this purpose; and\n(f) The maintenance and replacement of all items described above and all health and safety devices such as, but not limited to, gas earthquake valves, gas control valves, back flow preventers, water conditioning equipment and regulating valves. (832.36 CCR)",
    "active": true,
    "order": 28
  },
  {
    "id": "SCT-C-38",
    "code": "C-38",
    "name": "Refrigeration",
    "category": "specialty",
    "description": "A refrigeration contractor constructs, fabricates, erects, installs, maintains, services and repairs refrigerators, refrigerated rooms, and insulated refrigerated spaces, temperature insulation, air-conditioning units, ducts, blowers, registers, humidity and thermostatic controls for the control of air, liquid and/or gas temperatures below fifty degrees Fahrenheit (50º), or ten degrees Celsius (10º). (832.38 CCR)",
    "active": true,
    "order": 29
  },
  {
    "id": "SCT-C-39",
    "code": "C-39",
    "name": "Roofing",
    "category": "specialty",
    "description": "A roofing contractor installs products and repairs surfaces that seal, waterproof and weatherproof structures. This work is performed to prevent water or its derivatives, compounds or solids from penetrating such protection and gaining access to material or space beyond. In the course of this work, the contractor examines and/or prepares surfaces and uses the following material: asphaltum, pitch, tar, felt, glass fabric, urethane foam, metal roofing systems, flax, shakes, shingles, roof tile, slate or any other roofing, waterproofing or membrane material(s) or a combination thereof. (832.39 CCR)",
    "active": true,
    "order": 30
  },
  {
    "id": "SCT-C-42",
    "code": "C-42",
    "name": "Sanitation System",
    "category": "specialty",
    "description": "A sanitation system contractor fabricates and installs cesspools, septic tanks, storm drains, and other sewage disposal and drain structures. This classification includes the laying of cast iron, steel, concrete, vitreous and non-vitreous pipe and any other hardware associated with these systems. (832.42 CCR)",
    "active": true,
    "order": 31
  },
  {
    "id": "SCT-C-43",
    "code": "C-43",
    "name": "Sheet Metal",
    "category": "specialty",
    "description": "A sheet metal contractor selects, cuts, shapes, fabricates and installs sheet metal such as cornices, flashings, gutters, leaders, pans, kitchen equipment, duct work (including insulation, patented chimneys, metal flues, metal roofing systems and any other installations requiring sheet metal). (832.43 CCR)",
    "active": true,
    "order": 32
  },
  {
    "id": "SCT-C-45",
    "code": "C-45",
    "name": "Sign",
    "category": "specialty",
    "description": "A sign contractor fabricates, installs, and erects electrical signs, including the wiring of such electrical signs, and non-electrical signs, including but not limited to: post or pole supported signs, signs attached to structures, painted wall signs, and modifications to existing signs. (832.45 CCR)",
    "active": true,
    "order": 33
  },
  {
    "id": "SCT-C-46",
    "code": "C-46",
    "name": "Solar",
    "category": "specialty",
    "description": "A solar contractor installs, modifies, maintains, and repairs thermal and photovoltaic solar energy systems. A licensee classified in this section shall not undertake or perform building or construction trades, crafts, or skills, except when required to install a thermal or photovoltaic solar energy system. (832.46 CCR) Please see page 19 for additional information on contractor classifications authorized to perform solar projects.",
    "active": true,
    "order": 34
  },
  {
    "id": "SCT-C-47",
    "code": "C-47",
    "name": "General Manufactured Housing",
    "category": "specialty",
    "description": "(a) A general manufactured housing contractor installs, alters, repairs, or prepares for moving any type of manufactured home as defined in Section 18007 of the Health and Safety Code, any type of mobile home as defined in Section 18008 of the Health and Safety Code, and any type of multifamily manufactured home as defined in Section 18008.7 of the Health and Safety Code, including the accessory buildings or structures, and the foundations. A manufactured home does not include any recreational vehicle, commercial coach, or factory-built housing as defined in Section 19971 of the Health and Safety Code.\n(b) A general manufactured housing contractor may provide utility services on a single family individual site placement. Utility services mean the connection of gas, water, sewer, and electrical utilities to the home. (832.47 CCR)",
    "active": true,
    "order": 35
  },
  {
    "id": "SCT-C-50",
    "code": "C-50",
    "name": "Reinforcing Steel",
    "category": "specialty",
    "description": "A reinforcing steel contractor fabricates, places and ties steel mesh or steel reinforcing bars (rods), of any profile, perimeter, or cross-section that are or may be used to reinforce concrete structures. (832.50 CCR)",
    "active": true,
    "order": 36
  },
  {
    "id": "SCT-C-51",
    "code": "C-51",
    "name": "Structural Steel",
    "category": "specialty",
    "description": "A structural steel contractor fabricates and erects structural steel shapes and plates, of any profile, perimeter or cross-section that are or may be used as structural members for buildings and structures, including the riveting, welding, rigging, and metal roofing systems necessary to perform this work. (832.51 CCR)",
    "active": true,
    "order": 37
  },
  {
    "id": "SCT-C-53",
    "code": "C-53",
    "name": "Swimming Pool",
    "category": "specialty",
    "description": "A swimming pool contractor constructs swimming pools, spas or hot tubs, including installation of solar heating equipment using those trades or skills necessary for such construction. (832.53 CCR)",
    "active": true,
    "order": 38
  },
  {
    "id": "SCT-C-54",
    "code": "C-54",
    "name": "Ceramic and Mosaic Tile",
    "category": "specialty",
    "description": "A ceramic and mosaic tile contractor prepares surfaces as necessary and installs glazed wall, ceramic, mosaic, quarry, paver, faience, glass mosaic and stone tiles; thin tile that resembles full brick, natural or simulated stone slabs for bathtubs, showers and horizontal surfaces inside of buildings, or any tile units set in the traditional or innovative tile methods, excluding hollow or structural partition tile. (832.54 CCR)",
    "active": true,
    "order": 39
  },
  {
    "id": "SCT-C-55",
    "code": "C-55",
    "name": "Water Conditioning",
    "category": "specialty",
    "description": "A water conditioning contractor installs water conditioning equipment with the use of only such pipe and fittings as are necessary to connect the water conditioning equipment to the water supply system and to by-pass all those parts of the water supply system within the premises from which conditioned water is to be excluded. (832.55 CCR)",
    "active": true,
    "order": 40
  },
  {
    "id": "SCT-C-57",
    "code": "C-57",
    "name": "Well Drilling",
    "category": "specialty",
    "description": "A well drilling contractor installs and repairs water wells and pumps by boring, drilling, excavating, casing, cementing and cleaning to provide a supply of uncontaminated water. (832.57 CCR)",
    "active": true,
    "order": 41
  },
  {
    "id": "SCT-C-60",
    "code": "C-60",
    "name": "Welding",
    "category": "specialty",
    "description": "A welding contractor causes metal to become permanently attached, joined and fabricated by the use of gases and electrical energy, which creates temperatures of sufficient heat to perform this work. (832.60 CCR)",
    "active": true,
    "order": 42
  },
  {
    "id": "SCT-C-61",
    "code": "C-61",
    "name": "Limited Specialty",
    "category": "specialty",
    "description": "(a) Limited specialty is a specialty contractor classification limited to a field and scope of operations of specialty contracting for which an applicant is qualified other than any of the specialty contractor classifications listed and defined in this article.\n(b) An applicant classified and licensed in the classification Limited Specialty shall confine activities as a contractor to that field or fields and scope of operations set forth in the application and accepted by the Registrar or to that permitted by Section 831. (c) Upon issuance of a C-61 license, the Registrar shall endorse upon the face of the original license certificate the field and scope of operations in which the licensee has demonstrated qualifications.\n(d) A specialty contractor, other than a C-61 contractor, may perform work within the field and scope of the operations of Classification C-61, provided the work is consistent with the established usage and procedure in the construction industry and is related to the specialty contractor’s classification. (832.61 CCR)",
    "active": true,
    "order": 43
  },
  {
    "id": "SCT-D-03",
    "code": "D-03",
    "name": "Awnings",
    "category": "limited_specialty",
    "description": "An awning contractor installs, modifies or repairs aluminum, metal, vinyl or canvas awnings and patio covers. These installations can be either freestanding or attached to a structure. Patio enclosures or carports are not included in this classification.",
    "active": true,
    "order": 44
  },
  {
    "id": "SCT-D-04",
    "code": "D-04",
    "name": "Central Vacuum Systems",
    "category": "limited_specialty",
    "description": "A central vacuum systems contractor installs, modifies, maintains or repairs central vacuum systems, pneumatic tube dispatching systems or any other type of pipeline which operates systems of reduced pressure for any purpose.",
    "active": true,
    "order": 45
  },
  {
    "id": "SCT-D-06",
    "code": "D-06",
    "name": "Concrete-Related Services",
    "category": "limited_specialty",
    "description": "A concrete-related services contractor installs reusable steel concrete form sections or interlocking precast pavers; performs post-tensioning work, concrete sawing, breaking, curing, floor hardening treatment, coloring concrete, concrete restoration, coring work or operates a concrete pumping service; and also includes the application of gunite, but does not include the installation of reinforcing steel.",
    "active": true,
    "order": 46
  },
  {
    "id": "SCT-D-09",
    "code": "D-09",
    "name": "Drilling, Blasting and Oil Field Work",
    "category": "limited_specialty",
    "description": "A drilling, blasting and oil field work contractor does core and post hole drilling, horizontal drilling (no piping) and drilling for placement of charges and performing blasting work; performs drilling for site dewatering, oil well drilling and other oil field-related specialty work. (DOES NOT INCLUDE WATER WELL DRILLING)",
    "active": true,
    "order": 47
  },
  {
    "id": "SCT-D-10",
    "code": "D-10",
    "name": "Elevated Floors",
    "category": "limited_specialty",
    "description": "An elevated floors contractor installs wood or metal framed elevated computer flooring systems. This work does not include the construction of mezzanines.",
    "active": true,
    "order": 48
  },
  {
    "id": "SCT-D-12",
    "code": "D-12",
    "name": "Synthetic Products",
    "category": "limited_specialty",
    "description": "A synthetic products contractor installs:\n(a) Synthetic counter tops and wall coverings; fiberglass, plastic, vinyl and epoxy products; plastic tile board and decorative art work; and synthetic turf;\n(b) Bathtub and enamel refinishing, resin and epoxy application, and synthetic caulking and sealants;\n(c) Reservoir liners, vinyl swimming pool relining, pier piling wrap, and rodent guards; and\n(d) PVC piping systems for irrigation and drainage; and subsurface irrigation drip systems.",
    "active": true,
    "order": 49
  },
  {
    "id": "SCT-D-16",
    "code": "D-16",
    "name": "Hardware, Locks and Safes",
    "category": "limited_specialty",
    "description": "A hardware, locks and safes contractor installs, modifies or repairs power and/or manually activated door and window locks with related hardware, built-in safes, and vaults.",
    "active": true,
    "order": 50
  },
  {
    "id": "SCT-D-24",
    "code": "D-24",
    "name": "Metal Products",
    "category": "limited_specialty",
    "description": "A metal products contractor installs, modifies or repairs the following:\n(a) Metal cabinets, lockers, modular storage structures, mail chutes, cable racks; and aluminum or vinyl storm doors and windows;\n(b) Metal wall tiles; aluminum fascia covers; and metal gutters; and\n(c) Aluminum studs and trusses; metal railings and turnstiles; metal prison cell accessories such as welded-to-structure cell furniture; grills; and cabinets.",
    "active": true,
    "order": 51
  },
  {
    "id": "SCT-D-28",
    "code": "D-28",
    "name": "Doors, Gates and Activating Devices",
    "category": "limited_specialty",
    "description": "A doors, gates and activating devices contractor installs, modifies or repairs all types of residential, commercial or industrial doors including overhead or sliding door assemblies. This includes but is not limited to: wood and screen doors, metal-clad doors, glass sliding/ stationary doors and frames, automatic revolving doors, hospital cubical doors and related installations; power-activated doors, gates, movable sun shades/shutters; card-activated equipment and other access control device; and any low-voltage electronic or manually operated door hardware/device.",
    "active": true,
    "order": 52
  },
  {
    "id": "SCT-D-29",
    "code": "D-29",
    "name": "Paperhanging",
    "category": "limited_specialty",
    "description": "A paperhanging contractor applies all types and varieties of decorative wall coverings, except painting or paneling, including paper and vinyl goods, cork, burlap and carpet-type wall coverings.",
    "active": true,
    "order": 53
  },
  {
    "id": "SCT-D-30",
    "code": "D-30",
    "name": "Pile Driving/Pressure Foundation Jacking",
    "category": "limited_specialty",
    "description": "A pile driving/pressure foundation jacking contractor provides a pile driving and/or caisson drilling or auger service. This work also includes but is not limited to the injection of concrete or mortar into foundations for stabilization purposes.",
    "active": true,
    "order": 54
  },
  {
    "id": "SCT-D-31",
    "code": "D-31",
    "name": "Pole Installation and Maintenance",
    "category": "limited_specialty",
    "description": "A pole installation and maintenance contractor installs wood or precast poles to support the wiring or cable that is installed by others or installs and maintains flag poles.",
    "active": true,
    "order": 55
  },
  {
    "id": "SCT-D-34",
    "code": "D-34",
    "name": "Prefabricated Equipment",
    "category": "limited_specialty",
    "description": "A prefabricated equipment contractor performs installation of prefabricated products/ equipment, including but not limited to the following:\n(a) Theater stage equipment, school classroom equipment, playground equipment, bleacher bench/seat component parts (no installation or renovation of any supporting or structural member); store fixtures, and display cases (either prefabricated or modular form); all forms and types of toilet/shower room partitions/accessories; and prefabricated closet systems.\n(b) Laboratory and medical equipment, and dust-collecting systems; factory-built fireplaces and accessories (no masonry facing); major appliance installations and ventilating hoods in connection with existing fuel and energy lines which are installed by others.\n(c) Bus stop shelters, prefabricated phone booths; prefabricated sound proof environmental clean rooms; panelized refrigerated walk-in boxes (not to include the work of refrigeration contractor); all types of modular office, institutional or home improvement systems including, but not limited to, all types of pre-finished and/or UL listed pre-wired wall panels.",
    "active": true,
    "order": 56
  },
  {
    "id": "SCT-D-35",
    "code": "D-35",
    "name": "Pool and Spa Maintenance",
    "category": "limited_specialty",
    "description": "A pool and spa maintenance contractor installs, replaces or repairs pool motors, pumps, filters, gas heaters and any above-ground piping in connection with pools; includes electrical switches, breakers, pool lights, diving boards, existing solar systems that heat pools, pool and spa acid baths, and applies vinyl liners to existing surfaces.",
    "active": true,
    "order": 57
  },
  {
    "id": "SCT-D-38",
    "code": "D-38",
    "name": "Sand and Water Blasting",
    "category": "limited_specialty",
    "description": "A sand and water blasting contractor uses the force of compressed air in conjunction with abrasive materials or water to clean or prepare surfaces for any protective, decorative and/or functional treatment.",
    "active": true,
    "order": 58
  },
  {
    "id": "SCT-D-39",
    "code": "D-39",
    "name": "Scaffolding",
    "category": "limited_specialty",
    "description": "A scaffolding contractor erects metal or wood scaffolding including temporary sidewalk sheltered construction work barricades.",
    "active": true,
    "order": 59
  },
  {
    "id": "SCT-D-40",
    "code": "D-40",
    "name": "Service Station Equipment and Maintenance",
    "category": "limited_specialty",
    "description": "A service station maintenance contractor installs and/or removes underground fuel storage tanks up to 20,000 gallons which have been or are to be used for dispensing gasoline, diesel fuel, waste oil or kerosene (no chemicals). This work involves the installation and/ or removal of all incidental tank-related piping, electrical work, including the installation of vapor probes in back fill areas of the tanks and any associated calibration work including, but not limited to, the testing and adjustment of leak detection and vapor recovery equipment, such as automatic tank gauges, leak line detectors, vapor recovery lines, and in-station diagnostics. This contractor also performs the installation of auto hoisting equipment, grease racks, compressors, air hoses, and other service station equipment. NOTE: Licensees holding this classification prior to January 18, 2001, may perform all the work as described above. Licenses issued after this date may perform the “calibration” work only.",
    "active": true,
    "order": 60
  },
  {
    "id": "SCT-D-41",
    "code": "D-41",
    "name": "Siding and Decking",
    "category": "limited_specialty",
    "description": "A siding and decking contractor applies or installs all types of exterior siding including wood, wood products, vinyl, aluminum and metal siding to new or existing buildings. This contractor also constructs wooden decks and related handrails. This work shall not include the construction or installation of covers or enclosures of any kind.",
    "active": true,
    "order": 61
  },
  {
    "id": "SCT-D-42",
    "code": "D-42",
    "name": "Non-Electrical Sign Installation",
    "category": "limited_specialty",
    "description": "A non-electrical sign installation contractor fabricates and installs all types of nonelectrical signs including, but not limited to: post or pole-supported signs, signs attached to structures, painted wall signs, and modifications to existing signs.",
    "active": true,
    "order": 62
  },
  {
    "id": "SCT-D-49",
    "code": "D-49",
    "name": "Tree Service",
    "category": "limited_specialty",
    "description": "A tree service contractor prunes trees, removes trees, limbs or stumps (including grinding) and engages in tree or limb guying.",
    "active": true,
    "order": 63
  },
  {
    "id": "SCT-D-50",
    "code": "D-50",
    "name": "Suspended Ceilings",
    "category": "limited_specialty",
    "description": "A suspended ceilings contractor installs, modifies or repairs all types of suspended ceilings including, but not limited to: lay-in-grid and other types of systems involving solid, perforated or translucent ceiling panels (no electrical work).",
    "active": true,
    "order": 64
  },
  {
    "id": "SCT-D-52",
    "code": "D-52",
    "name": "Window Coverings",
    "category": "limited_specialty",
    "description": "A window coverings contractor installs or applies decorative, architectural/functional window/glass treatment or covering products including, but not limited to: all types of materials and fabrics that make up louvers, shutters, Venetian and mini-blinds; residential or commercial draperies and screens; expanded metal window and door guards; plastic film window treatment and/or any other window treatment applied for temperature control or as a screening device.",
    "active": true,
    "order": 65
  },
  {
    "id": "SCT-D-53",
    "code": "D-53",
    "name": "Wood Tanks",
    "category": "limited_specialty",
    "description": "A wood tanks contractor erects or repairs elevated wooden storage tanks and related cooling towers. (Hot tubs are not included.)",
    "active": true,
    "order": 66
  },
  {
    "id": "SCT-D-56",
    "code": "D-56",
    "name": "Trenching",
    "category": "limited_specialty",
    "description": "A trenching contractor is limited to trenching only for foundations, pipelines, conduit and related trenching work.",
    "active": true,
    "order": 67
  },
  {
    "id": "SCT-D-59",
    "code": "D-59",
    "name": "Hydroseed Spraying",
    "category": "limited_specialty",
    "description": "A hydroseed spraying contractor applies seeds through any liquid media to any type of surface that has been prepared or contoured by others.",
    "active": true,
    "order": 68
  },
  {
    "id": "SCT-D-62",
    "code": "D-62",
    "name": "Air and Water Balancing",
    "category": "limited_specialty",
    "description": "An air and water balancing contractor installs any device and performs any work related to providing a specified flow of air in all types of existing heating and cooling systems and/or related to providing a specified flow of water in water piping systems.",
    "active": true,
    "order": 69
  },
  {
    "id": "SCT-D-63",
    "code": "D-63",
    "name": "Construction Cleanup",
    "category": "limited_specialty",
    "description": "A construction cleanup contractor cleans up and/or removes from building grounds or structures any debris resultant from any construction project including, but not limited to: concrete, dirt, scrap lumber, plaster, drywall, any paint or adhesive products from windows, floors, ceramic tile and bathroom fixtures.",
    "active": true,
    "order": 70
  },
  {
    "id": "SCT-D-64",
    "code": "D-64",
    "name": "Non-specialized",
    "category": "limited_specialty",
    "description": "A non-specialized contractor installs, modifies, maintains and repairs new products and/ or new installations which are not defined in any section herein or defined in any license classification authorized by the Board under Chapter 9, Division 3 of the Business and Professions Code (Contractors License Law).",
    "active": true,
    "order": 71
  },
  {
    "id": "SCT-D-65",
    "code": "D-65",
    "name": "Weatherization and Energy Conservation",
    "category": "limited_specialty",
    "description": "A weatherization and energy conservation contractor installs, removes, modifies or repairs or provides maintenance services for energy conservation products limited to the following: door and window weather stripping, caulking, water heater pipe wrap, water heater blankets, insulating gaskets for electrical outlet covers, shade screens, shutters, storm windows, tinted window film, residential water flow restricting devices installed onto existing fixtures. (DOES NOT INCLUDE INSULATION, GLAZING OR HEATING VENTILATING AND AIR-CONDITIONING WORK)",
    "active": true,
    "order": 72
  }
];
