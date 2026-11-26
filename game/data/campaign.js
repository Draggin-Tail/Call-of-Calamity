/* Campaign data and world helpers (slice). Needs GAME_DATA (classes, gear, maps, races, factions), GAME_LOADOUT and GAME_SAVE.
   Node map positions are fractions of the painted map (x, y in 0..1) so the art can be swapped without touching data.
   Everything here is data plus small pure helpers: the screens that show it come in the menu step.

   NODE:      { name, region, type: hall|market|battle|road|choice|contested|town, pos:[x,y], faction?, owner?, desc, (links come from EDGES: [a, b, days])
                encounter?, choice?, shop?: [gearIds], recruit?: true }
   ENCOUNTER: { name, map, rec: recommended level, enemyFaction, enemies: [{primary, secondary?, name?}] (max 3), reward: { xp, gold, items },
                once?: true, options?: [{ id, label, enemyFaction, enemies, standing: { faction: delta }, reward }] }
   CHOICE:    { text, options: [{ id, label, standing?, gold?, flag?, relations?: [[a, b, delta, both]] }] }
   EVENT:     { id, day, once, text, effect(st) } fired by dueEvents(st) when the day passes. */
(function () {
  const C = {};
  const G = () => window.GAME_DATA, S = () => window.GAME_SAVE, LO = () => window.GAME_LOADOUT;

  // Regions: danger (0..3) sets how often the road throws something at you; faction is who keeps the roads (their patrols).
  C.REGIONS = {
    dwarven_holds: { name: 'Frostpeak Mountains', danger: 1, faction: 'ironbound' },
    iceflow:       { name: 'The Spinepeak Mountains', danger: 2, faction: 'ivory' },
    crownlands:    { name: 'Crownlands', danger: 1, faction: 'crown' },
    free_marches:  { name: 'The Marches', danger: 3, faction: 'crown' },
    river_cities:  { name: 'River Cities', danger: 1, faction: 'syndicate' },
    voldun:        { name: "Vol'Dun", danger: 1, faction: 'synod' },
    elven_realms:  { name: 'Silvan Thicket', danger: 2, faction: 'canopy' },
    orc_lands:     { name: 'The Rusted Wastes', danger: 2, faction: 'blood_iron' },
    goblin_fens:   { name: 'The Marshes of Mirewood', danger: 2, faction: 'mire_born' },
    scorched_desolation: { name: 'The Scorched Desolation', danger: 3, faction: null, unclaimed: true }   // no one holds it and no road leads there yet
  };

  // Territory outlines on the painted map (art/world.jpg, 1380 x 752; fractions of the picture), traced from the painted borders.
  // label: where the shell writes the name (painted: the art already names it). crop: the part of the picture its own region image (img) shows.
  // next: neighbouring territories (a road crosses the border). The four human lands share the Verdant Central Plains.
  C.TERRITORIES = {
    free_marches: {"label":[0.5,0.2633],"painted":false,"crop":[0.3551,0.1303,0.5986,0.359],"img":"art/regions/free_marches.jpg","next":["crownlands","dwarven_holds","elven_realms","voldun"],"poly":[[0.5841,0.3285],[0.558,0.3032],[0.5464,0.2872],[0.5355,0.262],[0.5348,0.234],[0.5377,0.1941],[0.5174,0.1543],[0.5043,0.1596],[0.4848,0.1941],[0.4732,0.2234],[0.4594,0.2473],[0.4406,0.246],[0.4254,0.2407],[0.4145,0.2287],[0.4,0.2274],[0.3877,0.234],[0.3855,0.2593],[0.3703,0.2899],[0.3935,0.3351],[0.4014,0.3351],[0.4181,0.3258],[0.4565,0.3351],[0.4978,0.3271],[0.5362,0.3351],[0.5783,0.3271]]},
    river_cities: {"label":[0.5304,0.7048],"painted":false,"crop":[0.4109,0.5904,0.6326,0.9322],"img":"art/regions/river_cities.jpg","next":["crownlands","goblin_fens","iceflow","voldun"],"poly":[[0.4246,0.6184],[0.4348,0.6489],[0.4297,0.6795],[0.4449,0.6995],[0.4638,0.7181],[0.4812,0.7487],[0.4906,0.7513],[0.4942,0.758],[0.4884,0.7713],[0.4783,0.7859],[0.4797,0.7952],[0.4797,0.8404],[0.4855,0.8324],[0.4942,0.8431],[0.5007,0.8431],[0.5051,0.8364],[0.5058,0.8271],[0.5094,0.8218],[0.5152,0.8324],[0.5225,0.8351],[0.5275,0.8444],[0.5355,0.8418],[0.5406,0.8471],[0.5428,0.8537],[0.5428,0.8684],[0.5391,0.8816],[0.5428,0.891],[0.5464,0.8923],[0.5486,0.887],[0.5522,0.887],[0.558,0.8989],[0.5572,0.9016],[0.5616,0.8989],[0.5703,0.9069],[0.5804,0.9082],[0.5833,0.9043],[0.5848,0.8896],[0.5884,0.8843],[0.5906,0.8856],[0.5942,0.8737],[0.5986,0.883],[0.5935,0.8989],[0.5986,0.9029],[0.6051,0.8949],[0.6058,0.8816],[0.6014,0.8816],[0.5993,0.8777],[0.6007,0.871],[0.5978,0.867],[0.6007,0.8617],[0.608,0.8577],[0.6109,0.8511],[0.6029,0.8338],[0.6022,0.8258],[0.6043,0.8218],[0.6152,0.8205],[0.6196,0.8138],[0.5862,0.7726],[0.5746,0.7394],[0.5754,0.7207],[0.5899,0.7048],[0.6,0.6888],[0.5949,0.6596],[0.5848,0.6396],[0.5804,0.6223],[0.5565,0.6263],[0.5152,0.617],[0.479,0.625],[0.4413,0.6144]]},
    crownlands: {"label":[0.4667,0.4375],"painted":false,"crop":[0.3812,0.3032,0.5384,0.6476],"img":"art/regions/crownlands.jpg","next":["free_marches","iceflow","river_cities","voldun"],"poly":[[0.3942,0.3364],[0.4145,0.3843],[0.4043,0.4495],[0.4232,0.504],[0.4297,0.5386],[0.4225,0.5598],[0.4297,0.5878],[0.4254,0.617],[0.4413,0.613],[0.4812,0.6237],[0.5217,0.6157],[0.5196,0.5785],[0.5254,0.5266],[0.5174,0.4801],[0.5254,0.4282],[0.5138,0.3816],[0.5196,0.3324],[0.4978,0.3285],[0.4565,0.3364],[0.4181,0.3271],[0.4014,0.3364]]},
    voldun: {"label":[0.5783,0.4867],"painted":false,"crop":[0.5014,0.3045,0.6775,0.6489],"img":"art/regions/voldun.jpg","next":["crownlands","elven_realms","free_marches","goblin_fens","river_cities"],"poly":[[0.5855,0.3298],[0.5783,0.3285],[0.5442,0.3364],[0.5196,0.3338],[0.5145,0.3816],[0.5261,0.4282],[0.5181,0.4801],[0.5261,0.5266],[0.5203,0.5785],[0.5225,0.6157],[0.5565,0.625],[0.5797,0.621],[0.5841,0.6024],[0.5877,0.5957],[0.6217,0.5652],[0.6399,0.5545],[0.6399,0.504],[0.6514,0.4814],[0.6645,0.4641],[0.6594,0.4495],[0.6022,0.3923],[0.5993,0.3843],[0.5957,0.3391]]},
    dwarven_holds: {"label":[0.4391,0.1423],"painted":true,"crop":[0.3261,0.0213,0.6971,0.2939],"img":"art/regions/dwarven_holds.jpg","next":["elven_realms","free_marches","iceflow"],"poly":[[0.3493,0.0984],[0.3493,0.129],[0.3667,0.1463],[0.3638,0.1795],[0.3877,0.234],[0.3986,0.2274],[0.4138,0.2274],[0.4246,0.2394],[0.4594,0.2473],[0.4732,0.2234],[0.479,0.2061],[0.5051,0.1582],[0.5174,0.1543],[0.5377,0.1941],[0.5601,0.1848],[0.5746,0.1995],[0.5949,0.2048],[0.6043,0.1848],[0.621,0.2074],[0.65,0.2699],[0.6645,0.2593],[0.6717,0.2101],[0.6746,0.1596],[0.6638,0.1237],[0.6348,0.0798],[0.6471,0.0519],[0.6572,0.0452],[0.3783,0.0452],[0.3732,0.0519],[0.3768,0.0559],[0.3681,0.0665],[0.3652,0.0638],[0.3609,0.0731],[0.3536,0.0785]]},
    iceflow: {"label":[0.3913,0.6383],"painted":true,"crop":[0.2471,0.137,0.4891,0.8205],"img":"art/regions/iceflow.jpg","next":["crownlands","dwarven_holds","orc_lands","river_cities"],"poly":[[0.3638,0.1795],[0.3536,0.2021],[0.3297,0.2247],[0.3203,0.2487],[0.3036,0.2806],[0.279,0.3005],[0.2623,0.3098],[0.2746,0.3338],[0.2993,0.3378],[0.3094,0.3537],[0.3471,0.383],[0.3529,0.3949],[0.3594,0.4402],[0.3645,0.4588],[0.3746,0.4787],[0.3775,0.5093],[0.3674,0.5399],[0.3696,0.5612],[0.3746,0.5785],[0.3449,0.609],[0.3486,0.637],[0.3587,0.6676],[0.3819,0.7168],[0.3833,0.7593],[0.3877,0.7593],[0.392,0.7646],[0.3971,0.7793],[0.4007,0.7793],[0.4058,0.7713],[0.413,0.7793],[0.4239,0.7739],[0.4319,0.7753],[0.4391,0.7646],[0.4399,0.7553],[0.4435,0.7473],[0.4514,0.7473],[0.4551,0.7434],[0.4594,0.7287],[0.463,0.7301],[0.4652,0.7274],[0.471,0.7394],[0.4746,0.7394],[0.4645,0.7194],[0.4457,0.7008],[0.4297,0.6782],[0.4348,0.6489],[0.4246,0.6197],[0.4297,0.5878],[0.4225,0.5612],[0.4297,0.5386],[0.4232,0.504],[0.4043,0.4495],[0.4145,0.3843],[0.3928,0.3324],[0.3703,0.2899],[0.3855,0.2593],[0.3877,0.234]]},
    elven_realms: {"label":[0.7428,0.3604],"painted":true,"crop":[0.5123,0.0066,0.8717,0.629],"img":"art/regions/elven_realms.jpg","next":["dwarven_holds","free_marches","goblin_fens","voldun"],"poly":[[0.5377,0.1941],[0.5348,0.2593],[0.5442,0.2832],[0.5594,0.3045],[0.5957,0.3404],[0.6,0.3896],[0.6551,0.4441],[0.6638,0.4614],[0.6399,0.504],[0.6399,0.5545],[0.6768,0.5745],[0.6986,0.5918],[0.7203,0.5758],[0.7384,0.5492],[0.7717,0.5492],[0.8007,0.5279],[0.8254,0.5226],[0.8406,0.4947],[0.837,0.4854],[0.8297,0.484],[0.8261,0.4774],[0.8254,0.4681],[0.8217,0.4628],[0.8246,0.4535],[0.8312,0.4535],[0.8326,0.4508],[0.8326,0.4441],[0.8362,0.4348],[0.8449,0.4388],[0.85,0.4362],[0.85,0.3085],[0.837,0.3072],[0.8333,0.3019],[0.8355,0.2979],[0.85,0.2952],[0.8442,0.1569],[0.8341,0.1529],[0.8304,0.1476],[0.8275,0.1489],[0.8232,0.141],[0.8217,0.133],[0.8138,0.1303],[0.8094,0.1449],[0.7993,0.1463],[0.7928,0.137],[0.7899,0.1263],[0.7812,0.1223],[0.7783,0.1277],[0.7768,0.1383],[0.7746,0.1423],[0.7703,0.1423],[0.7645,0.1343],[0.7587,0.1343],[0.7522,0.1144],[0.7442,0.117],[0.7406,0.1104],[0.7428,0.1024],[0.7457,0.1051],[0.75,0.1024],[0.7493,0.0851],[0.7391,0.0878],[0.737,0.0838],[0.7203,0.0838],[0.7181,0.0785],[0.7123,0.0745],[0.7072,0.0758],[0.7029,0.0705],[0.7,0.0705],[0.6964,0.0785],[0.6877,0.0785],[0.6855,0.0838],[0.6913,0.0931],[0.6906,0.0984],[0.6862,0.1064],[0.6797,0.1064],[0.6768,0.1144],[0.6746,0.1144],[0.6717,0.1077],[0.6761,0.0984],[0.6833,0.0997],[0.6826,0.0931],[0.6768,0.0838],[0.6761,0.0785],[0.6529,0.0758],[0.6457,0.0691],[0.6493,0.0638],[0.6565,0.0665],[0.663,0.0545],[0.6659,0.0572],[0.6696,0.0545],[0.6804,0.0572],[0.6855,0.0532],[0.6884,0.0572],[0.6964,0.0479],[0.7029,0.0452],[0.658,0.0452],[0.6449,0.0545],[0.6348,0.0798],[0.6652,0.1263],[0.6746,0.1596],[0.6717,0.2101],[0.6652,0.2566],[0.6623,0.262],[0.65,0.2699],[0.621,0.2074],[0.6043,0.1848],[0.5949,0.2048],[0.5754,0.2008],[0.5594,0.1848]]},
    goblin_fens: {"label":[0.6587,0.6782],"painted":true,"crop":[0.5551,0.4694,0.8717,0.8737],"img":"art/regions/goblin_fens.jpg","next":["elven_realms","river_cities","voldun"],"poly":[[0.8471,0.5013],[0.8457,0.496],[0.8406,0.4947],[0.8246,0.5239],[0.8,0.5293],[0.7732,0.5492],[0.7384,0.5492],[0.7196,0.5771],[0.7,0.5918],[0.6399,0.5545],[0.6014,0.5824],[0.5848,0.5997],[0.5797,0.6184],[0.5848,0.6396],[0.5949,0.6596],[0.6,0.6888],[0.5891,0.7061],[0.5754,0.7194],[0.5746,0.7394],[0.5848,0.7699],[0.6196,0.8138],[0.6239,0.8138],[0.637,0.8378],[0.6384,0.8338],[0.6341,0.8258],[0.6326,0.8112],[0.6268,0.8045],[0.621,0.8032],[0.6159,0.7952],[0.6181,0.7912],[0.6225,0.7926],[0.6174,0.7846],[0.6196,0.7793],[0.6261,0.7846],[0.6246,0.7899],[0.6268,0.7939],[0.6348,0.7979],[0.6377,0.7912],[0.6399,0.7952],[0.6377,0.8045],[0.6384,0.8098],[0.6442,0.8178],[0.6514,0.8098],[0.6514,0.8019],[0.6543,0.7965],[0.6572,0.8032],[0.6572,0.8112],[0.6623,0.8191],[0.6725,0.8019],[0.6754,0.8112],[0.6797,0.8085],[0.6855,0.8191],[0.6819,0.8258],[0.6884,0.8311],[0.6899,0.8298],[0.687,0.8231],[0.6891,0.8165],[0.6862,0.8098],[0.6877,0.8005],[0.6935,0.7912],[0.6935,0.7872],[0.6862,0.7886],[0.6804,0.7806],[0.6826,0.7766],[0.6841,0.7793],[0.6877,0.7766],[0.6906,0.7806],[0.6942,0.7779],[0.6993,0.7606],[0.7022,0.7673],[0.6978,0.7793],[0.7,0.7926],[0.6971,0.7979],[0.6957,0.7965],[0.6957,0.8032],[0.6971,0.8045],[0.7014,0.7926],[0.7051,0.7926],[0.7072,0.7886],[0.7116,0.8045],[0.7167,0.8019],[0.7196,0.8045],[0.7239,0.7926],[0.7312,0.7846],[0.7333,0.7886],[0.7326,0.7965],[0.7442,0.8205],[0.7435,0.8404],[0.7471,0.8378],[0.7471,0.8285],[0.7551,0.8152],[0.7601,0.8218],[0.758,0.8138],[0.7601,0.8098],[0.763,0.8165],[0.7674,0.8178],[0.7688,0.8098],[0.7717,0.8059],[0.7739,0.8098],[0.7717,0.8178],[0.7739,0.8218],[0.7819,0.8191],[0.7812,0.8112],[0.7833,0.8032],[0.7812,0.7992],[0.7841,0.7939],[0.7877,0.8005],[0.787,0.8152],[0.7913,0.8098],[0.7942,0.8138],[0.7957,0.8112],[0.7993,0.8138],[0.7935,0.8032],[0.7957,0.7992],[0.8,0.8005],[0.8036,0.8072],[0.8036,0.8152],[0.813,0.8338],[0.8116,0.8364],[0.8123,0.8471],[0.8261,0.8404],[0.8348,0.8431],[0.8384,0.8497],[0.837,0.8444],[0.8406,0.8404],[0.842,0.8112],[0.8326,0.8098],[0.829,0.8032],[0.8312,0.7992],[0.8341,0.8019],[0.8362,0.7979],[0.8391,0.8005],[0.842,0.7979],[0.837,0.7979],[0.8348,0.7939],[0.8435,0.7859],[0.8486,0.7035],[0.8442,0.7101],[0.8377,0.6995],[0.8319,0.7061],[0.8283,0.6995],[0.8304,0.6928],[0.8268,0.6941],[0.8225,0.6848],[0.8167,0.6835],[0.8152,0.6862],[0.8109,0.6795],[0.813,0.6755],[0.8167,0.6782],[0.821,0.6742],[0.8275,0.6809],[0.8275,0.6755],[0.8319,0.6689],[0.8297,0.6702],[0.8246,0.6649],[0.8109,0.6649],[0.808,0.6609],[0.8014,0.6676],[0.7993,0.6636],[0.8,0.6596],[0.7928,0.6662],[0.7906,0.6596],[0.7957,0.6503],[0.8029,0.6503],[0.8116,0.641],[0.8152,0.6489],[0.8167,0.641],[0.813,0.637],[0.8181,0.6303],[0.8275,0.6343],[0.8297,0.6383],[0.8268,0.6277],[0.829,0.621],[0.8283,0.6104],[0.8254,0.6051],[0.8275,0.6011],[0.8333,0.6064],[0.8384,0.5931],[0.8449,0.5944],[0.8464,0.5904],[0.8457,0.5838],[0.8486,0.5785],[0.8471,0.5731],[0.8529,0.5652],[0.8514,0.5625],[0.8522,0.5532],[0.85,0.5492],[0.8486,0.5319],[0.8457,0.5226],[0.8486,0.512],[0.8464,0.5053]]},
    orc_lands: {"label":[0.1601,0.5465],"painted":true,"crop":[0.0362,0.2699,0.4051,0.9056],"img":"art/regions/orc_lands.jpg","next":["iceflow"],"poly":[[0.3478,0.3843],[0.3101,0.3551],[0.3,0.3391],[0.2754,0.3351],[0.2623,0.3098],[0.2391,0.3258],[0.1645,0.3444],[0.1616,0.363],[0.1623,0.3684],[0.1674,0.3763],[0.1674,0.3896],[0.1717,0.4082],[0.1768,0.4069],[0.179,0.4109],[0.1761,0.4162],[0.1688,0.4189],[0.1652,0.4295],[0.1594,0.4309],[0.1551,0.4415],[0.1413,0.4362],[0.1362,0.4402],[0.1333,0.4468],[0.1275,0.4481],[0.1232,0.4388],[0.1174,0.4335],[0.1123,0.4335],[0.1101,0.4295],[0.1116,0.4255],[0.1087,0.4136],[0.1036,0.4069],[0.0833,0.4069],[0.0783,0.4109],[0.0761,0.4242],[0.0717,0.4322],[0.0696,0.4495],[0.0667,0.4548],[0.0645,0.4668],[0.0775,0.4668],[0.0935,0.4388],[0.1007,0.4375],[0.1029,0.4428],[0.1007,0.4561],[0.0986,0.4601],[0.0949,0.4601],[0.0942,0.4747],[0.0971,0.484],[0.092,0.4987],[0.0877,0.5],[0.0826,0.5133],[0.0761,0.5027],[0.0667,0.508],[0.0601,0.5186],[0.0594,0.5266],[0.063,0.5319],[0.0594,0.5426],[0.0601,0.5532],[0.0667,0.5638],[0.0623,0.5838],[0.0638,0.5891],[0.0703,0.5957],[0.0681,0.5997],[0.0688,0.6064],[0.0833,0.621],[0.0841,0.629],[0.0783,0.6436],[0.0775,0.6529],[0.0783,0.6582],[0.0841,0.6662],[0.0812,0.6809],[0.0848,0.6875],[0.0848,0.6981],[0.0891,0.7048],[0.0978,0.7061],[0.1087,0.7247],[0.1123,0.7473],[0.1159,0.754],[0.1181,0.766],[0.1159,0.7806],[0.1203,0.7899],[0.1217,0.8072],[0.1261,0.8152],[0.1341,0.8152],[0.1507,0.8364],[0.1565,0.8311],[0.1609,0.8178],[0.1703,0.8351],[0.1754,0.8391],[0.1797,0.8497],[0.1855,0.8537],[0.1971,0.8497],[0.2007,0.8577],[0.2094,0.8564],[0.2159,0.867],[0.2391,0.8471],[0.2471,0.8285],[0.2543,0.8285],[0.2609,0.8165],[0.2667,0.8258],[0.2783,0.8258],[0.2819,0.8218],[0.2848,0.8231],[0.2884,0.8165],[0.2899,0.8191],[0.2942,0.8072],[0.2942,0.7992],[0.2978,0.7952],[0.2964,0.7926],[0.3051,0.7753],[0.3101,0.7779],[0.321,0.7473],[0.3232,0.746],[0.329,0.7513],[0.3391,0.75],[0.3413,0.746],[0.3471,0.7473],[0.3536,0.7354],[0.3638,0.7327],[0.3667,0.7247],[0.3659,0.7194],[0.3696,0.7114],[0.3754,0.7181],[0.3804,0.7394],[0.3804,0.7447],[0.3761,0.754],[0.3775,0.7593],[0.3819,0.762],[0.3826,0.7194],[0.3587,0.6676],[0.3486,0.637],[0.3449,0.6104],[0.3746,0.5798],[0.3696,0.5612],[0.3674,0.5399],[0.3775,0.5093],[0.3746,0.4787],[0.3645,0.4588],[0.3594,0.4402],[0.3543,0.3989]]},
    scorched_desolation: {"label":[0.2145,0.2447],"painted":true,"crop":[0.0964,0.0492,0.3841,0.3684],"img":"art/regions/scorched_desolation.jpg","next":["dwarven_holds","iceflow","orc_lands"],"poly":[[0.358,0.0731],[0.3486,0.0811],[0.3435,0.0745],[0.3391,0.0785],[0.3341,0.0904],[0.3268,0.0931],[0.3239,0.0851],[0.3181,0.0851],[0.3145,0.0957],[0.3036,0.1024],[0.2971,0.0944],[0.2978,0.0904],[0.2949,0.0838],[0.2804,0.0851],[0.2761,0.0957],[0.2725,0.0984],[0.2739,0.1024],[0.2688,0.1104],[0.2638,0.1037],[0.2594,0.1024],[0.2565,0.1077],[0.2594,0.1144],[0.2572,0.1223],[0.2587,0.1277],[0.2572,0.1436],[0.2522,0.1476],[0.2486,0.1569],[0.2464,0.1543],[0.2428,0.1556],[0.2377,0.1636],[0.2261,0.1636],[0.2181,0.1516],[0.213,0.1529],[0.2065,0.1609],[0.2029,0.1569],[0.2058,0.1476],[0.2101,0.1476],[0.2181,0.1316],[0.2232,0.1316],[0.2312,0.125],[0.2399,0.1077],[0.2391,0.1037],[0.2341,0.1011],[0.2261,0.113],[0.2203,0.113],[0.2181,0.117],[0.2145,0.1117],[0.2167,0.1051],[0.2232,0.1051],[0.2246,0.0971],[0.2326,0.0838],[0.2326,0.0758],[0.2203,0.0771],[0.2094,0.0864],[0.2051,0.0851],[0.2029,0.0957],[0.1957,0.1064],[0.1942,0.133],[0.1913,0.1383],[0.1935,0.1516],[0.1906,0.1569],[0.1855,0.1543],[0.1819,0.1569],[0.1674,0.1782],[0.1623,0.1769],[0.1558,0.1809],[0.1536,0.1862],[0.1558,0.1955],[0.1493,0.2035],[0.142,0.1981],[0.1348,0.2061],[0.1283,0.2221],[0.121,0.2301],[0.1225,0.234],[0.1217,0.2434],[0.1159,0.2553],[0.1145,0.2633],[0.1159,0.2819],[0.1239,0.2926],[0.1283,0.2912],[0.1326,0.3005],[0.1362,0.2979],[0.1384,0.3019],[0.1413,0.3005],[0.1413,0.2912],[0.1457,0.2806],[0.1478,0.2872],[0.1522,0.2846],[0.1609,0.2859],[0.1645,0.2819],[0.1696,0.2926],[0.1739,0.2886],[0.1761,0.2939],[0.1638,0.3231],[0.1645,0.3444],[0.2007,0.3324],[0.2399,0.3245],[0.2797,0.2992],[0.3029,0.2806],[0.3203,0.2487],[0.3319,0.2221],[0.3558,0.1995],[0.3638,0.1795],[0.3667,0.1449],[0.3493,0.1277],[0.3493,0.0984],[0.3522,0.0824]]}
  };

  // Nodes carry no links: roads are listed once in EDGES (days between the two places) and filled in both ways below.
  C.NODES = {
    // ---- Dwarven Holds (north) ----
    hollow_deep:   { name: 'Hollow Deep', region: 'dwarven_holds', type: 'battle', pos: [0.35, 0.08], encounter: 'hollow_deep',
                     desc: 'An abandoned delve. Something has moved into the lower galleries and the Ironbound want it cleared.' },
    deepdelve:     { name: 'Deepdelve', region: 'dwarven_holds', type: 'hall', faction: 'ironbound', owner: 'ironbound', pos: [0.46, 0.09], recruit: true,
                     shop: ['maul', 'tower_shield', 'plate_armor'], desc: 'Oldest of the holds. Oaths are carved into every pillar.' },
    ironforge:     { name: 'Ironforge Bastion', region: 'dwarven_holds', type: 'hall', faction: 'anvil', owner: 'anvil', pos: [0.58, 0.08], recruit: true,
                     shop: ['hand_crossbow', 'crossbow', 'chain_coif', 'vigor_ring'], encounter: 'forge_trial', desc: 'The Guild of the Gilded Anvil sells engineers, and sometimes their contracts.' },
    anvil_works:   { name: 'Anvil Works', region: 'dwarven_holds', type: 'market', faction: 'anvil', owner: 'anvil', pos: [0.69, 0.14],
                     shop: ['crossbow', 'halberd', 'chain_hauberk', 'focus_charm'], desc: 'Guild foundries that run day and night. The smoke can be seen from the river.' },
    glimmer_vein:  { name: 'Glimmer Vein', region: 'dwarven_holds', type: 'town', owner: 'ironbound', pos: [0.37, 0.19],
                     shop: ['iron_mace', 'wraps', 'knuckles', 'chain_coif', 'buckler'], desc: 'A mining camp strung along a seam of pale ore. Everyone here owes someone.' },
    mine_collapse: { name: 'Collapsed Gallery', region: 'dwarven_holds', type: 'choice', pos: [0.50, 0.20], choice: 'mine_collapse',
                     desc: 'A gallery has fallen in. The holds and the Guild both want what is under it.' },
    frostgate:     { name: 'Frostgate', region: 'dwarven_holds', type: 'town', owner: 'ironbound', pos: [0.61, 0.25],
                     shop: ['plate_helm', 'tower_shield', 'frost_ward', 'warding_amulet'], desc: 'The gatehouse where the holds meet the river road. Guards check every cart twice.' },
    // ---- Iceflow (the river between holds and plains) ----
    iceflow_road:  { name: 'Iceflow Road', region: 'iceflow', type: 'road', pos: [0.44, 0.31], encounter: 'iceflow_ambush',
                     desc: 'The cold road along the river between the plains and the holds.' },
    koestielve:    { name: 'Koestielve', region: 'iceflow', type: 'market', owner: 'ironbound', pos: [0.54, 0.34],
                     shop: ['iron_mace', 'buckler', 'plate_helm', 'warding_amulet'], desc: 'A border market where dwarf steel meets human coin.' },
    frozen_ford:   { name: 'Frozen Ford', region: 'iceflow', type: 'town', pos: [0.66, 0.32],
                     shop: ['spear', 'javelin', 'traveler_boots', 'vigor_ring'], desc: 'Ice thick enough to cross in winter, ferrymen thick enough to cross you in summer.' },
    river_watch:   { name: 'River Watch', region: 'iceflow', type: 'battle', pos: [0.77, 0.30], encounter: 'river_watch',
                     desc: 'A border tower whose garrison stopped taking orders from anyone.' },
    // ---- Crownlands ----
    old_milestone: { name: 'Old Milestone', region: 'crownlands', type: 'choice', pos: [0.45, 0.41], choice: 'old_milestone',
                     desc: 'A weathered stone where four roads meet. A stranded caravan has jammed the junction.' },
    crown_keep:    { name: 'Crown Keep', region: 'crownlands', type: 'hall', faction: 'crown', owner: 'crown', pos: [0.55, 0.47], recruit: true,
                     shop: ['iron_sword', 'round_shield', 'chain_hauberk'], desc: 'Seat of the Royalist Crown. Knights drill in the yard and the lords argue upstairs.' },
    harrow_farms:  { name: 'Harrow Farms', region: 'crownlands', type: 'town', owner: 'crown', pos: [0.65, 0.42],
                     shop: ['iron_sword', 'buckler', 'silk_hood', 'healer_locket'], desc: 'Flat fields and fat granaries. The Crown takes a tenth and the Syndicate buys the rest.' },
    stonebridge:   { name: 'Stonebridge', region: 'crownlands', type: 'market', owner: 'crown', pos: [0.60, 0.56],
                     shop: ['halberd', 'katana', 'chain_hauberk', 'round_shield', 'swift_charm'], desc: 'A great arched bridge with a market on top of it.' },
    // ---- Free Marches ----
    bandit_ford:   { name: 'Bandit Ford', region: 'free_marches', type: 'battle', pos: [0.35, 0.50], encounter: 'bandit_ford',
                     desc: 'A river crossing held by deserters who tax every traveller.' },
    free_marches:  { name: 'Free Marches', region: 'free_marches', type: 'contested', owner: 'crown', pos: [0.45, 0.60],
                     desc: 'Border farmland claimed by both the Crown and the Syndicate. Raiders are circling.' },
    wayfarers_rest:{ name: "Wayfarer's Rest", region: 'free_marches', type: 'town', pos: [0.33, 0.64], recruit: true,
                     shop: ['steel_dagger', 'traveler_boots', 'vigor_ring'], desc: 'An inn at a crossroads, where sellswords wait for someone to hire them.' },
    thornfield:    { name: 'Thornfield', region: 'free_marches', type: 'battle', pos: [0.47, 0.72], encounter: 'thornfield_camp',
                     desc: 'Burned farms and a raider camp in the hedgerows.' },
    // ---- River Cities ----
    river_cities:  { name: 'River Cities', region: 'river_cities', type: 'market', faction: 'syndicate', owner: 'syndicate', pos: [0.40, 0.82], recruit: true,
                     shop: ['hand_crossbow', 'steel_dagger', 'swift_charm', 'vigor_ring', 'traveler_boots'], desc: 'A web of docks and counting houses. Everything has a price, including the magistrates.' },
    low_docks:     { name: 'Low Docks', region: 'river_cities', type: 'market', owner: 'syndicate', pos: [0.52, 0.86],
                     shop: ['wand_storm', 'wand_cold', 'steel_dagger', 'lute', 'ember_ward'], desc: 'Warehouses, cranes and no questions.' },
    greywater_landing: { name: 'Greywater Landing', region: 'river_cities', type: 'town', owner: 'syndicate', pos: [0.27, 0.80],
                     shop: ['javelin', 'longbow', 'traveler_boots', 'storm_ward'], desc: 'A ferry town where the river meets the elven coast road.' },
    reed_marsh:    { name: 'Reed Marsh', region: 'river_cities', type: 'road', pos: [0.55, 0.77],
                     desc: 'A causeway through reeds taller than a man. Easy to lose a cart here, easier to lose a person.' },
    salt_road:     { name: 'Salt Road', region: 'river_cities', type: 'road', pos: [0.60, 0.67],
                     desc: 'The old salt route from the river towns up to Vol\'Dun.' },
    // ---- Vol'Dun ----
    voldun:        { name: "Vol'Dun", region: 'voldun', type: 'hall', faction: 'synod', owner: 'synod', pos: [0.72, 0.54], recruit: true,
                     shop: ['staff_arcane', 'tome_focus', 'mana_ring', 'sage_pendant'], desc: 'The Ascendant Synod keeps its tower here and its watchers in every street.' },
    synod_gardens: { name: 'Synod Gardens', region: 'voldun', type: 'market', faction: 'synod', owner: 'synod', pos: [0.81, 0.44],
                     shop: ['staff_holy', 'staff_fire', 'spellbook', 'mystic_robe', 'mana_ring'], desc: 'Terraced orchards where the Synod grows its herbs and keeps its secrets.' },
    orchard_row:   { name: 'Orchard Row', region: 'voldun', type: 'town', owner: 'synod', pos: [0.70, 0.67],
                     shop: ['wand_holy', 'holy_relic', 'healer_locket', 'sage_pendant'], desc: 'A quiet village of lamplighters and apothecaries.' },
    ashen_obelisk: { name: 'Ashen Obelisk', region: 'voldun', type: 'battle', pos: [0.79, 0.65], encounter: 'ashen_obelisk',
                     desc: 'A black standing stone that hums at night. Someone has been making offerings to it.' },
    eastern_pass:  { name: 'Eastern Pass', region: 'voldun', type: 'road', pos: [0.90, 0.54],
                     desc: 'The high road east toward the dark mountains. Few go further than the cairn.' },
    // ---- Elven Realms ----
    whispering_glade: { name: 'Whispering Glade', region: 'elven_realms', type: 'choice', pos: [0.13, 0.24], choice: 'whispering_glade',
                     desc: 'A Warden shrine inside a ring of old oaks. Someone has been mapping it.' },
    heartwood_trail:  { name: 'Heartwood Trail', region: 'elven_realms', type: 'battle', pos: [0.24, 0.31], encounter: 'heartwood_poachers',
                     desc: 'A narrow trail through the deep forest. Poachers have been setting snares across it.' },
    sylvan_watch:  { name: 'Sylvan Watch', region: 'elven_realms', type: 'hall', faction: 'canopy', owner: 'canopy', pos: [0.10, 0.40], recruit: true,
                     shop: ['longbow', 'hand_crossbow', 'traveler_boots', 'wand_nature'], desc: 'The Wardens watch the treeline from platforms no road reaches.' },
    felled_grove:  { name: 'Felled Grove', region: 'elven_realms', type: 'battle', pos: [0.25, 0.46], encounter: 'felled_grove',
                     desc: 'Crown loggers have cut into the old forest. The Wardens have noticed.' },
    port_vane:     { name: 'Port Vane', region: 'elven_realms', type: 'market', owner: 'syndicate', pos: [0.13, 0.60], encounter: 'vane_smugglers',
                     shop: ['steel_dagger', 'wand_storm', 'ember_ward', 'frost_ward', 'storm_ward'], desc: 'A free port where elves, humans and smugglers do business.' },
    mosswood_camp: { name: 'Mosswood Camp', region: 'elven_realms', type: 'battle', pos: [0.22, 0.69], encounter: 'mosswood_camp',
                     desc: 'A camp of poachers and fences hidden in the moss, selling Warden game to anyone.' }
  };
  // ======================================================================================
  // The world on the clean painted map. Positions are fractions of the picture (x right, y down).
  // Existing places are re-fitted (FIT); new ones are listed in PLACES. Roads inside a region are generated
  // from the layout (below); roads between regions are explicit chains of stops (ROUTES).
  // ======================================================================================
  const FIT = {
    hollow_deep: [0.42, 0.09], deepdelve: [0.52, 0.135, { type: 'capital', capital: 'ironbound', shopFriendly: ['plate_armor', 'plate_helm', 'tower_shield'] }],
    ironforge: [0.58, 0.16, { type: 'capital', capital: 'anvil', shopFriendly: ['crossbow', 'greatsword', 'warding_totem'] }],
    anvil_works: [0.66, 0.19], glimmer_vein: [0.47, 0.225], mine_collapse: [0.535, 0.22], frostgate: [0.64, 0.27],
    iceflow_road: [0.715, 0.29], koestielve: [0.775, 0.395], frozen_ford: [0.805, 0.455], river_watch: [0.85, 0.475],
    old_milestone: [0.52, 0.33], crown_keep: [0.625, 0.42, { type: 'capital', capital: 'crown', shopFriendly: ['plate_armor', 'plate_helm', 'warding_amulet'] }],
    harrow_farms: [0.67, 0.375], stonebridge: [0.565, 0.505],
    bandit_ford: [0.455, 0.27], free_marches: [0.385, 0.18], wayfarers_rest: [0.355, 0.235], thornfield: [0.46, 0.525],
    river_cities: [0.45, 0.645, { name: 'Gildhaven', type: 'capital', capital: 'syndicate', shopFriendly: ['focus_charm', 'warding_amulet', 'mystic_robe'] }],
    low_docks: [0.43, 0.705], greywater_landing: [0.425, 0.77], reed_marsh: [0.585, 0.84, { type: 'zone', danger: 2 }], salt_road: [0.495, 0.605],
    voldun: [0.74, 0.565, { type: 'capital', capital: 'synod', shopFriendly: ['staff_holy', 'holy_relic', 'silk_hood'] }],
    synod_gardens: [0.815, 0.5], orchard_row: [0.675, 0.565], ashen_obelisk: [0.72, 0.705], eastern_pass: [0.91, 0.6],
    whispering_glade: [0.15, 0.26], heartwood_trail: [0.22, 0.245],
    sylvan_watch: [0.125, 0.37, { type: 'capital', capital: 'canopy', shopFriendly: ['staff_nature', 'warding_totem', 'silk_hood'] }],
    felled_grove: [0.19, 0.29], port_vane: [0.205, 0.405], mosswood_camp: [0.205, 0.515, { land: 'isle' }]
  };
  Object.entries(FIT).forEach(([id, f]) => { const n = C.NODES[id]; if (!n) throw new Error('FIT: unknown ' + id); n.pos = [f[0], f[1]]; Object.assign(n, f[2] || {}); });

  // [id, name, region, type, x, y, description, extras]. Types: castle, town, village, hamlet, poi (point of interest), zone (a named area).
  const PLACES = [
    // ---- Elven Realms: the north-western continent ----
    ['rimecap_reach', 'Rimecap Reach', 'elven_realms', 'zone', 0.15, 0.115, 'Wind-scoured snowfields where Warden scouts keep their first winter watch.', { danger: 2 }],
    ['hermits_rime', "Hermit's Rime", 'elven_realms', 'poi', 0.115, 0.135, 'A hut of frozen driftwood. The old woman inside trades in rumours.', { choice: 'hermits_rime' }],
    ['gull_light', 'Gull Light', 'elven_realms', 'poi', 0.2, 0.095, 'A bone-white lighthouse that someone still keeps lit.'],
    ['lone_beacon', 'Lone Beacon', 'elven_realms', 'poi', 0.255, 0.078, 'A signal fire on a rock, reached by a rope bridge at low tide.'],
    ['kestrel_rock', 'Kestrel Rock', 'elven_realms', 'hamlet', 0.185, 0.155, 'A dozen huts clinging to the rock. The Wardens train hawks here.'],
    ['cradlepine', 'Cradlepine', 'elven_realms', 'village', 0.175, 0.21, 'Wooden stairways wind up a tree the width of a house.', { shop: ['longbow', 'traveler_boots'] }],
    ['thornwarden_keep', 'Thornwarden Keep', 'elven_realms', 'castle', 0.215, 0.19, 'A fortress grown, not built, from living thornwood.', { faction: 'canopy', owner: 'canopy' }],
    ['elderwood', 'The Elderwood', 'elven_realms', 'zone', 0.125, 0.235, 'The oldest part of the forest. Even the Wardens go quietly here.', { danger: 1 }],
    ['bramblewick', 'Bramblewick', 'elven_realms', 'village', 0.1, 0.275, 'Honey, candles and a surprising number of cats.', { shop: ['healer_locket', 'wand_nature'] }],
    ['thistledown', 'Thistledown', 'elven_realms', 'hamlet', 0.095, 0.33, 'Charcoal burners and a very old well.'],
    ['moonwell', 'Moonwell', 'elven_realms', 'poi', 0.145, 0.315, 'A pool that holds the moon even on cloudy nights.', { choice: 'moonwell' }],
    ['highspire_rest', 'Highspire Rest', 'elven_realms', 'poi', 0.135, 0.175, 'A cairn-shrine high on the ridge, with a view of the whole forest.', { choice: 'highspire_rest' }],
    ['whitepan', 'The Whitepan', 'elven_realms', 'zone', 0.225, 0.31, 'A dazzling salt flat. Travellers lose a day to the glare and the silence.', { danger: 1 }],
    ['glass_hollow', 'Glass Hollow', 'elven_realms', 'poi', 0.235, 0.355, 'A crater where lightning once fused the salt into green glass.'],
    ['seedwatch', 'Seedwatch', 'elven_realms', 'hamlet', 0.165, 0.345, 'Seed-keepers guard the forest’s last stands of rare trees.'],
    ['fernmouth', 'Fernmouth', 'elven_realms', 'village', 0.145, 0.415, 'A fishing village where the forest meets the sea.', { shop: ['traveler_boots', 'healer_locket'] }],
    // ---- Elven Realms: the Pearl Isles ----
    ['pearl_shallows', 'Pearl Shallows', 'elven_realms', 'zone', 0.115, 0.52, 'Warm shallows full of divers, and of things that bite divers.', { land: 'isle', danger: 1 }],
    ['tidemother_shrine', "Tidemother's Shrine", 'elven_realms', 'poi', 0.15, 0.47, 'Shell-covered steps lead into the water. Offerings float away at dawn.', { land: 'isle', choice: 'tidemother_shrine' }],
    ['kelp_market', 'Kelp Market', 'elven_realms', 'market', 0.17, 0.515, 'A market on lashed boats, where the isles trade with anyone.', { land: 'isle', shop: ['steel_dagger', 'swift_charm', 'vigor_ring'], recruit: true }],
    ['drowned_orchard', 'Drowned Orchard', 'elven_realms', 'poi', 0.17, 0.56, 'Fruit trees stand in knee-deep water, still blossoming.', { land: 'isle' }],
    ['skerry_rest', 'Skerry Rest', 'elven_realms', 'hamlet', 0.1, 0.57, 'Stilt houses on a bare reef.', { land: 'isle' }],
    ['reefwatch', 'Reefwatch', 'elven_realms', 'village', 0.205, 0.595, 'Pilots who guide ships through the reefs live here, and charge for it.', { land: 'isle', shop: ['spear', 'buckler'] }],
    ['wreckers_cove', "Wrecker's Cove", 'elven_realms', 'poi', 0.155, 0.635, 'A cove littered with ship timbers. Not all of them wrecked by accident.', { land: 'isle' }],
    ['whitepan_landing', 'Whitepan Landing', 'elven_realms', 'hamlet', 0.262, 0.332, 'A salt-workers\u2019 landing on the edge of the flats, and the Wardens\u2019 door to the mainland.'],
    ['fishers_ledge', "Fisher's Ledge", 'elven_realms', 'hamlet', 0.235, 0.435, 'A single rock, a single dock, a great many nets.', { land: 'isle' }],
    // ---- Free Marches: the northern plains and the Greatwood ----
    ['gullsong', 'Gullsong', 'free_marches', 'hamlet', 0.325, 0.11, 'Salt-hardened herders on a windy coast.'],
    ['driftmoor_farm', 'Driftmoor Farm', 'free_marches', 'village', 0.395, 0.105, 'A big farm that keeps its own militia, just in case.', { shop: ['spear', 'buckler'] }],
    ['carrow_tower', 'Carrow Tower', 'free_marches', 'poi', 0.425, 0.155, 'A ruined watchtower. Someone has been digging in the cellar.', { choice: 'carrow_tower' }],
    ['widows_barrow', "Widow's Barrow", 'free_marches', 'poi', 0.335, 0.185, 'A burial mound the locals avoid after dusk.', { choice: 'widows_barrow' }],
    ['lowmeadows', 'The Lowmeadows', 'free_marches', 'zone', 0.41, 0.225, 'Rolling grassland with too many places for riders to hide.', { danger: 3 }],
    ['hobbs_reach', "Hobb's Reach", 'free_marches', 'village', 0.44, 0.205, 'A fortified farming town that hires swords every spring.', { shop: ['iron_sword', 'buckler', 'traveler_boots'], recruit: true }],
    ['greywatch_post', 'Greywatch Post', 'free_marches', 'castle', 0.475, 0.185, 'A Crown garrison post that guards the pass to the holds, mostly from boredom.', { faction: 'crown', owner: 'crown' }],
    ['greatwood', 'The Greatwood', 'free_marches', 'zone', 0.43, 0.37, 'The great forest of the marches. Trails shift, and so do the people on them.', { danger: 3 }],
    ['mooncircle', 'Mooncircle', 'free_marches', 'poi', 0.385, 0.435, 'A clearing ringed with white stones. Nothing grows inside.', { choice: 'mooncircle' }],
    ['tanglewick', 'Tanglewick', 'free_marches', 'village', 0.36, 0.34, 'Woodcutters, trappers and a famously bad tavern.', { shop: ['healer_locket', 'longbow'] }],
    ['rootbridge', 'Rootbridge', 'free_marches', 'hamlet', 0.46, 0.33, 'A bridge made from one fallen tree and a great deal of rope.'],
    ['foxhallow', 'Foxhallow', 'free_marches', 'hamlet', 0.355, 0.5, 'A burrow-village under a hillside. Visitors duck.'],
    ['sentinel_ring', 'Sentinel Ring', 'free_marches', 'poi', 0.485, 0.42, 'Seven standing stones, each carved with a watching eye.', { choice: 'sentinel_ring' }],
    ['outlaws_rest', "Outlaw's Rest", 'free_marches', 'poi', 0.41, 0.5, 'A hollow oak with a smoke hole. The tracks around it are fresh.', { choice: 'outlaws_rest' }],
    ['glasswood_spires', 'Glasswood Spires', 'free_marches', 'poi', 0.325, 0.47, 'Tall, pale trees along the western shore that ring like glass in the wind.', { choice: 'glasswood_spires' }],
    // ---- Dwarven Holds: the northern mountains ----
    ['kettle_stair', 'Kettle Stair', 'dwarven_holds', 'hamlet', 0.455, 0.15, 'A rest stop with a kettle that has never been cold.'],
    ['deeproot_mines', 'Deeproot Mines', 'dwarven_holds', 'poi', 0.48, 0.105, 'Old workings that follow a tree root nine hundred feet down.', { choice: 'deeproot_mines' }],
    ['runefall', 'Runefall', 'dwarven_holds', 'poi', 0.555, 0.095, 'A waterfall carved with thousands of small runes. Scribes come to read it.', { choice: 'runefall' }],
    ['hammerrest', 'Hammerrest', 'dwarven_holds', 'castle', 0.61, 0.205, 'A fortress-hall of the Ironbound, built across the road to make a point.', { faction: 'ironbound', owner: 'ironbound' }],
    ['coldspring_lodge', 'Coldspring Lodge', 'dwarven_holds', 'hamlet', 0.64, 0.11, 'Hot springs, thick stone walls and a no-weapons rule that is not obeyed.'],
    ['pickaxe_row', 'Pickaxe Row', 'dwarven_holds', 'village', 0.575, 0.245, 'Miners’ housing that grew into a village with opinions.', { shop: ['iron_mace', 'round_shield'] }],
    ['ember_gallery', 'Ember Gallery', 'dwarven_holds', 'poi', 0.5, 0.275, 'A seam that glows faintly red. The Guild says it is mineral. The Ironbound say otherwise.'],
    ['brazier_peak', 'Brazier Peak', 'dwarven_holds', 'zone', 0.6, 0.075, 'High peaks where beacon fires warn the holds of weather and war.', { danger: 2 }],
    ['giants_tooth', "Giant's Tooth", 'dwarven_holds', 'zone', 0.72, 0.13, 'A jagged range split by wind-blasted passes. Few come back by the same one.', { danger: 2 }],
    ['skyward_watch', 'Skyward Watch', 'dwarven_holds', 'castle', 0.755, 0.19, 'The Ironbound’s eastern lookout, higher than the clouds on most days.', { faction: 'ironbound', owner: 'ironbound' }],
    ['stonehearth', 'Stonehearth', 'dwarven_holds', 'village', 0.505, 0.185, 'The first village to cook with geothermal heat, and proud of it.', { shop: ['iron_mace', 'chain_coif'] }],
    // ---- Iceflow: the north-eastern highlands ----
    ['rimewater', 'Rimewater', 'iceflow', 'village', 0.745, 0.225, 'A village by a glacial stream, always a little cold.', { shop: ['spear', 'traveler_boots'] }],
    ['stormbreak_hold', 'Stormbreak Hold', 'iceflow', 'castle', 0.695, 0.23, 'An Ironbound fortress on a spur, taking the worst of every storm.', { faction: 'ironbound', owner: 'ironbound' }],
    ['whitepine_lodge', 'Whitepine Lodge', 'iceflow', 'hamlet', 0.79, 0.27, 'Trappers’ lodge with an enormous hearth.'],
    ['snowmelt_tarn', 'Snowmelt Tarn', 'iceflow', 'poi', 0.81, 0.215, 'A perfectly still black pool. Locals say it has no bottom.'],
    ['frozen_falls', 'Frozen Falls', 'iceflow', 'poi', 0.735, 0.355, 'A waterfall frozen mid-fall, with a cave behind it.'],
    ['frostmarch', 'The Frostmarch', 'iceflow', 'zone', 0.82, 0.33, 'Bleak, windblown heights where the caravans do not stop.', { danger: 3 }],
    ['elk_meadow', 'Elk Meadow', 'iceflow', 'hamlet', 0.835, 0.395, 'A high pasture, and a village built around a very large herd.'],
    ['wolfmothers_den', "Wolfmother's Den", 'iceflow', 'poi', 0.735, 0.445, 'A cave with pups’ bones outside and fresh tracks leading in.', { choice: 'wolfmothers_den' }],
    ['last_cairn', 'Last Cairn', 'iceflow', 'poi', 0.865, 0.405, 'A cairn at the eastern edge of the known highlands. Travellers add stones.'],
    // ---- Crownlands: the central plains ----
    ['beacon_hill', 'Beacon Hill', 'crownlands', 'poi', 0.605, 0.31, 'A hill with a signal fire, ready to warn Crown Keep in an hour.'],
    ['kingsway_cross', 'Kingsway Cross', 'crownlands', 'village', 0.585, 0.365, 'Where the great roads meet. Every cart pays a halfpenny to the Crown.', { shop: ['iron_sword', 'traveler_boots'] }],
    ['sheepfold', 'Sheepfold', 'crownlands', 'hamlet', 0.555, 0.29, 'Wool, and a surprisingly well-armed shepherds’ guild.'],
    ['rivermeet', 'Rivermeet', 'crownlands', 'town', 0.54, 0.435, 'Where two rivers join and three taxes are collected.', { shop: ['steel_dagger', 'round_shield', 'healer_locket'] }],
    ['millers_weir', "Miller's Weir", 'crownlands', 'hamlet', 0.51, 0.385, 'A mill, a weir and a long-running feud over both.'],
    ['whitestone_abbey', 'Whitestone Abbey', 'crownlands', 'poi', 0.665, 0.455, 'A quiet abbey of the Synod. The monks keep excellent records of everyone who visits.', { choice: 'whitestone_abbey' }],
    ['dunmere_keep', 'Dunmere Keep', 'crownlands', 'castle', 0.715, 0.425, 'A Crown fortress on the road east. Its lord is a little too independent.', { faction: 'crown', owner: 'crown' }],
    ['golden_reach', 'The Golden Reach', 'crownlands', 'zone', 0.64, 0.5, 'The breadbasket of the Crown, endless wheat from here to the horizon.', { danger: 1 }],
    ['duskwater_mill', 'Duskwater Mill', 'crownlands', 'hamlet', 0.6, 0.475, 'A mill that grinds half the Crown’s flour.'],
    ['pennant_green', 'Pennant Green', 'crownlands', 'village', 0.505, 0.47, 'A village with a muster-field and an impressive collection of banners.', { shop: ['spear', 'longbow'] }],
    // ---- River Cities: the southern peninsula and the Mirefen ----
    ['tollhouse_quay', 'Tollhouse Quay', 'river_cities', 'village', 0.49, 0.68, 'Every barge pays here. The collector knows everyone’s business.', { shop: ['hand_crossbow', 'traveler_boots'] }],
    ['barley_wharf', 'Barley Wharf', 'river_cities', 'village', 0.47, 0.74, 'Granaries and warehouses, and a fierce dock-workers’ guild.', { shop: ['steel_dagger', 'vigor_ring'] }],
    ['greycrown_peak', 'Greycrown Peak', 'river_cities', 'poi', 0.525, 0.655, 'A lone peak. Smugglers use it as a landmark and bandits as a lair.'],
    ['lantern_point', 'Lantern Point', 'river_cities', 'poi', 0.435, 0.83, 'A lighthouse owned jointly by four rival merchant houses.'],
    ['copperfield', 'Copperfield', 'river_cities', 'village', 0.475, 0.805, 'Orchards and a copper foundry that runs day and night.', { shop: ['iron_sword', 'round_shield'] }],
    ['drowned_chapel', 'Drowned Chapel', 'river_cities', 'poi', 0.585, 0.62, 'A chapel that sank into the marsh, bell and all.', { choice: 'drowned_chapel' }],
    ['mirefen', 'The Mirefen', 'river_cities', 'zone', 0.6, 0.7, 'A flooded maze of reeds and boardwalks.', { danger: 2 }],
    ['bogwater', 'Bogwater', 'river_cities', 'hamlet', 0.57, 0.75, 'Reed cutters and eel traps.'],
    ['stilt_market', 'Stilt Market', 'river_cities', 'market', 0.63, 0.76, 'A market on stilts that moves a little each season.', { shop: ['swift_charm', 'healer_locket', 'steel_dagger'], recruit: true }],
    ['peat_cuts', 'Peat Cuts', 'river_cities', 'village', 0.6, 0.9, 'Peat diggers’ village, and a long way from anywhere.', { shop: ['spear', 'buckler'] }],
    ['heron_hide', 'Heron Hide', 'river_cities', 'poi', 0.635, 0.94, 'A hunters’ blind on stilts, with a view of the whole fen.'],
    // ---- Vol’Dun: the eastern plains, the Ashlands and the Saltmere ----
    ['pilgrims_stair', "Pilgrim's Stair", 'voldun', 'village', 0.785, 0.575, 'Pilgrims climb the steps on their knees. The Synod provides the knee pads.', { shop: ['wand_holy', 'healer_locket'] }],
    ['sunwheel_chapel', 'Sunwheel Chapel', 'voldun', 'castle', 0.865, 0.55, 'A chapel-fortress with a great wheel of brass that tracks the sun.', { faction: 'synod', owner: 'synod' }],
    ['cantors_rest', "Cantor's Rest", 'voldun', 'hamlet', 0.71, 0.515, 'Choirs rest here between cities. Travelers get free hymns.'],
    ['reliquary_hill', 'Reliquary Hill', 'voldun', 'poi', 0.81, 0.63, 'A hill of tombs where the Synod keeps its saints.', { choice: 'reliquary_hill' }],
    ['cinder_gate', 'Cinder Gate', 'voldun', 'castle', 0.7, 0.635, 'The Synod’s fortress at the foot of the volcano. They watch it, and it watches back.', { faction: 'synod', owner: 'synod' }],
    ['ashfall_reach', 'Ashfall Reach', 'voldun', 'zone', 0.675, 0.745, 'Black ash falls like snow here. Few people live and fewer stay.', { danger: 3 }],
    ['vent_hollow', 'Vent Hollow', 'voldun', 'poi', 0.765, 0.73, 'A steaming crack in the earth, and the bones of whatever fell in.', { choice: 'vent_hollow' }],
    ['brimstone_chapel', 'Brimstone Chapel', 'voldun', 'poi', 0.715, 0.79, 'A ruined chapel built from yellow rock.'],
    ['obsidian_terraces', 'Obsidian Terraces', 'voldun', 'zone', 0.66, 0.87, 'Black glass terraces crossing the ashen desert. Sharp, and bright in sunlight.', { danger: 3 }],
    ['sandwatch', 'Sandwatch', 'voldun', 'hamlet', 0.725, 0.9, 'A few mud-brick huts around a well.'],
    ['saltmere', 'The Saltmere', 'voldun', 'zone', 0.85, 0.8, 'Brackish channels and reed islands. Easy to get lost, easier to be robbed.', { danger: 2 }],
    ['reedwife', 'Reedwife', 'voldun', 'hamlet', 0.835, 0.7, 'A small marsh village known for its basket weavers.'],
    ['marshlight', 'Marshlight', 'voldun', 'village', 0.885, 0.745, 'Houses on floating reed mats, lit by lanterns each night.', { shop: ['spear', 'swift_charm'] }],
    ['sinkhole_shrine', 'Sinkhole Shrine', 'voldun', 'poi', 0.905, 0.82, 'A shrine on the rim of a sinkhole. Offerings go in. Nothing comes out.', { choice: 'sinkhole_shrine' }]
  ];
  PLACES.forEach(([id, name, region, type, x, y, desc, ex]) => { if (C.NODES[id]) throw new Error('duplicate place ' + id); C.NODES[id] = Object.assign({ name, region, type, pos: [x, y], desc }, ex || {}); });

  // ======================================================================================
  // Land allocation (v3). The world is divided into nine territories drawn on the painted map. Places listed
  // in LAYOUT keep their names and encounters but move to their new home; NEWPLACES fills every territory out.
  // Parked places are kept in C.PARKED (the empty western landmass and isles) and are not on the map.
  // ======================================================================================
  const NEWPLACES = [
    ['hearthstone_priory', 'Hearthstone Priory', 'river_cities', 'castle', 0.596, 0.704, 'The mother-house of the Hearthwatch. Anyone may sleep by its fire, and no one is asked what they did.', { faction: 'hearthwatch', owner: 'hearthwatch' }],
    ['ledgerhall', 'Ledgerhall', 'river_cities', 'castle', 0.63, 0.553, 'The Syndicate keeps its records here. Its clerks know what everyone owes.', { faction: 'syndicate', owner: 'syndicate' }],
    ['debtors_tower', 'Debtors\' Tower', 'river_cities', 'castle', 0.54, 0.59, 'Defaulters work off what they owe here. Many never leave.', { faction: 'syndicate', owner: 'syndicate' }],
    ['silverdeep_gate', 'Silverdeep Gate', 'iceflow', 'castle', 0.822, 0.394, 'A gate of pale stone, closed to most. The wards on it flicker.', { faction: 'ivory', owner: 'ivory' }],
    ['frost_archive', 'The Frost Archive', 'iceflow', 'castle', 0.766, 0.441, 'Libraries cut into the ice, guarded by librarians with spears.', { faction: 'ivory', owner: 'ivory' }],
    ['aldermere_hold', 'Aldermere Hold', 'crownlands', 'castle', 0.502, 0.292, 'A border lord\'s keep. Its master counts the throne\'s claimants at supper.', { faction: 'crown', owner: 'crown' }],
    ['marchwardens_post', 'Marchwarden\'s Post', 'free_marches', 'castle', 0.425, 0.254, 'A lonely stone post. The garrison is half the size the rolls claim.', { faction: 'crown' }],
    ['wardens_lodge', 'Warden\'s Lodge', 'elven_realms', 'hall', 0.458, 0.47, 'A timber hall high in the trees, where the Wardens muster.', { faction: 'canopy', owner: 'canopy' }],
    ['ash_court', 'The Ash Court', 'voldun', 'castle', 0.807, 0.617, 'Where heresy is judged. The doors are always open and the floor is always swept.', { faction: 'synod', owner: 'synod' }],
    ['blackstone_archive', 'Blackstone Archive', 'voldun', 'castle', 0.678, 0.616, 'Banned books are kept here, for safekeeping.', { faction: 'synod', owner: 'synod' }],
    ['bloodforge', 'Bloodforge', 'orc_lands', 'castle', 0.646, 0.96, 'A walled war-camp that has grown into a city. The drums never stop.', { faction: 'blood_iron', owner: 'blood_iron' }],
    ['tusk_gate', 'Tusk Gate', 'orc_lands', 'hall', 0.604, 0.889, 'A gate hung with trophies. The Legion counts every one.', { faction: 'blood_iron', owner: 'blood_iron' }],
    ['embers_hearth', 'The Ember-Speaker\'s Hearth', 'orc_lands', 'castle', 0.683, 0.869, 'A volcanic cave-hall where shamans read the ashes of the dead.', { faction: 'ash_speakers', owner: 'ash_speakers' }],
    ['fusehouse', 'Fusehouse', 'goblin_fens', 'castle', 0.894, 0.639, 'The Cartel\'s counting house. Its walls are mostly crates.', { faction: 'bilge_rats', owner: 'bilge_rats' }],
    ['mudcrown', 'Mudcrown', 'goblin_fens', 'castle', 0.846, 0.797, 'A hall of packed mud and reed, the seat of the Mire-Born.', { faction: 'mire_born', owner: 'mire_born' }],
    ['grain_exchange', 'The Grain Exchange', 'river_cities', 'market', 0.486, 0.572, 'A hall where one shout can move the price of bread across the realm.', { shop: ['healer_locket', 'traveler_boots', 'steel_dagger'] }],
    ['canalgate', 'Canalgate', 'river_cities', 'town', 0.585, 0.557, 'Locks, tolls and a very patient queue of carts.', { shop: ['hand_crossbow', 'swift_charm'] }],
    ['mercers_row', 'Mercers\' Row', 'river_cities', 'market', 0.481, 0.707, 'Silk, spice and second-hand swords, sold from the same stall.', { shop: ['mystic_robe', 'focus_charm', 'silk_hood'] }],
    ['harvest_cross', 'Harvest Cross', 'river_cities', 'town', 0.654, 0.681, 'A market crossroads where three rivers\' grain meets three guilds\' ledgers.'],
    ['pennywise_inn', 'The Pennywise Inn', 'river_cities', 'town', 0.568, 0.7, 'Cheap rooms, dear drinks and a ledger behind the bar.'],
    ['lantern_terrace', 'Lantern Terrace', 'iceflow', 'town', 0.746, 0.245, 'Elven townhouses on carved snow-stone steps, lit all night.'],
    ['low_winter_court', 'Court of Low Winter', 'iceflow', 'town', 0.785, 0.367, 'Where the minor houses wait out the cold and compare their ancestors.'],
    ['cogsmith_row', 'Cogsmith Row', 'dwarven_holds', 'market', 0.627, 0.244, 'Gilded Anvil engineers sell gears, rifles and a great many warranties.', { shop: ['crossbow', 'warding_totem', 'tower_shield'], owner: 'anvil' }],
    ['bellows_gate', 'Bellows Gate', 'dwarven_holds', 'town', 0.694, 0.31, 'A tunnel town that breathes with the forges below.'],
    ['heralds_cross', 'Herald\'s Cross', 'crownlands', 'town', 0.548, 0.242, 'Proclamations are read here, and promptly argued about.'],
    ['crownwatch_inn', 'Crownwatch Inn', 'crownlands', 'town', 0.633, 0.333, 'A coaching inn where every lord keeps a spy at the bar.'],
    ['lampwright_street', 'Lampwright Street', 'voldun', 'town', 0.864, 0.565, 'Lamp-makers, ward-smiths and informers with very clean hands.'],
    ['inquisitors_rest', 'Inquisitor\'s Rest', 'voldun', 'town', 0.782, 0.54, 'An inn where nobody speaks above a whisper.'],
    ['scriptorium_row', 'Scriptorium Row', 'voldun', 'market', 0.908, 0.617, 'Scrolls, wards and warnings, priced accordingly.', { shop: ['staff_holy', 'wand_holy', 'holy_relic'] }],
    ['slagmarket', 'Slagmarket', 'orc_lands', 'market', 0.47, 0.894, 'Looted goods change hands here for iron, salt and promises.', { shop: ['halberd', 'buckler', 'steel_dagger'] }],
    ['bilgeport', 'Bilgeport', 'goblin_fens', 'market', 0.761, 0.798, 'The Cartel\'s stinking, profitable harbour town.', { shop: ['hand_crossbow', 'swift_charm', 'traveler_boots'], owner: 'bilge_rats' }],
    ['powder_row', 'Powder Row', 'goblin_fens', 'town', 0.802, 0.884, 'Alchemists, bombers and a fire brigade that never stops working.', { owner: 'bilge_rats' }],
    ['toadstool_market', 'Toadstool Market', 'goblin_fens', 'market', 0.921, 0.819, 'Mushrooms, poisons and the antidotes, sold by the same stall.', { shop: ['healer_locket', 'vigor_ring'] }],
    ['pilgrims_well', 'Pilgrim\'s Well', 'crownlands', 'town', 0.506, 0.487, 'A roadside shrine with a deep well and a busy inn.', { shop: ['healer_locket', 'steel_dagger', 'vigor_ring'] }],
    ['tollbridge_camp', 'Tollbridge Camp', 'river_cities', 'town', 0.426, 0.709, 'Carters wait here for the bridge crowds to thin.', { shop: ['halberd', 'buckler', 'swift_charm'] }],
    ['barge_landing', 'Barge Landing', 'river_cities', 'town', 0.507, 0.635, 'Where grain barges tie up before the cities.', { shop: ['hand_crossbow', 'traveler_boots', 'vigor_ring'] }],
    ['lamplighters_rest', 'Lamplighter\'s Rest', 'voldun', 'town', 0.767, 0.633, 'The Synod lights a lamp here every dusk, and counts who stops.', { shop: ['wand_holy', 'sage_pendant', 'healer_locket'] }],
    ['fogwater', 'The Fogwater', 'river_cities', 'zone', 0.641, 0.617, 'A reed maze the smugglers know and the tax-men fear.', { danger: 2 }],
    ['muster_field', 'Muster Field', 'crownlands', 'zone', 0.581, 0.423, 'Where the lords\' levies gather. The grass has not recovered from the last war.', { danger: 1 }],
    ['hollow_fields', 'The Hollow Fields', 'crownlands', 'zone', 0.607, 0.482, 'Pasture marked with old battle stones. Veterans refuse to camp here.', { danger: 1 }],
    ['hungry_mile', 'The Hungry Mile', 'free_marches', 'zone', 0.469, 0.247, 'Burnt farmland where no one will settle.', { danger: 3 }],
    ['long_stair', 'The Long Stair', 'voldun', 'zone', 0.845, 0.621, 'Ten thousand steps to the Synod\'s high cloister.', { danger: 1 }],
    ['molten_run', 'Molten Run', 'orc_lands', 'zone', 0.654, 0.855, 'A river of slow fire. Orcs cross it on dares.', { danger: 3 }],
    ['quicklime_pits', 'Quicklime Isle', 'goblin_fens', 'zone', 0.938, 0.6455, 'White pits where the Cartel disposes of the inconvenient.', { danger: 2 }],
    ['rotwood', 'Rotwood', 'goblin_fens', 'zone', 0.728, 0.947, 'A drowned forest where the trees are dead and the owls are not.', { danger: 3 }],
    ['the_sump', 'The Sump', 'goblin_fens', 'zone', 0.802, 0.731, 'A lightless pit where the fen drains. Even goblins go round.', { danger: 3 }],
    ['old_toll', 'The Old Toll', 'river_cities', 'poi', 0.427, 0.616, 'A ruined toll house. Its last keeper vanished with the strongbox.'],
    ['bargemans_cairn', 'Bargeman\'s Cairn', 'river_cities', 'poi', 0.54, 0.648, 'Drowned bargemen are remembered here with a stone each. The cairn is tall.'],
    ['fading_wards', 'The Fading Wards', 'iceflow', 'poi', 0.827, 0.334, 'A ring of rune-pillars. One in five has gone dark.', { danger: 2 }],
    ['starfall_tarn', 'Starfall Tarn', 'iceflow', 'poi', 0.852, 0.386, 'A mirror-still lake. The elves say it keeps the stars when the sky does not.'],
    ['oathstone', 'The Oathstone', 'dwarven_holds', 'poi', 0.69, 0.13, 'Clan oaths are cut into the rock here. Broken oaths are chiselled out.'],
    ['oath_cairn', 'Oath Cairn', 'crownlands', 'poi', 0.507, 0.23, 'Knights swear here. The newest stones are the shallowest.'],
    ['kings_barrow', 'The King\'s Barrow', 'crownlands', 'poi', 0.546, 0.416, 'The old king\'s tomb, sealed, and guarded by nobles who do not agree on why.'],
    ['signal_tower', 'Signal Tower', 'crownlands', 'poi', 0.479, 0.516, 'A beacon tower, last lit at the old king\'s death.'],
    ['gallows_hill', 'Gallows Hill', 'free_marches', 'poi', 0.349, 0.105, 'Crown justice, left up as a warning. Some of the ropes are new.'],
    ['dewfall_glade', 'Dewfall Glade', 'elven_realms', 'poi', 0.51, 0.341, 'A glade where the dew never dries. Wardens leave offerings here.'],
    ['pyre_field', 'The Pyre Field', 'voldun', 'poi', 0.706, 0.581, 'A field of cold ash where the Synod burns forbidden books. Sometimes more.', { danger: 1 }],
    ['chantry_of_names', 'Chantry of Names', 'voldun', 'poi', 0.66, 0.571, 'The names of the dead mages are read aloud here, once a day.'],
    ['sunken_cloister', 'Sunken Cloister', 'voldun', 'poi', 0.828, 0.573, 'A cloister that slipped into the earth. Something still sings in it.', { danger: 2 }],
    ['warbanner_hill', 'Warbanner Hill', 'orc_lands', 'poi', 0.469, 0.796, 'A hill bristling with banners of the realms the Legion has beaten.'],
    ['skull_quarry', 'Skull Quarry', 'orc_lands', 'poi', 0.586, 0.809, 'A quarry full of old bones. The orcs dig here for something else.', { danger: 2 }],
    ['ash_stair', 'The Ash Stair', 'orc_lands', 'poi', 0.677, 0.77, 'Shamans climb it before they speak with the dead.'],
    ['vent_of_the_dead', 'Vent of the Dead', 'orc_lands', 'poi', 0.66, 0.894, 'A vent that breathes names. Shamans listen and write them down.', { danger: 2 }],
    ['sulphur_springs', 'Sulphur Springs', 'goblin_fens', 'poi', 0.783, 0.964, 'Yellow pools where the alchemists harvest what the Cartel sells.', { danger: 2 }],
    ['bubbling_vats', 'The Bubbling Vats', 'goblin_fens', 'poi', 0.952, 0.777, 'An open air laboratory. Do not light a pipe.', { danger: 2, owner: 'bilge_rats' }],
    ['bone_bridge', 'Bone Bridge', 'goblin_fens', 'poi', 0.919, 0.904, 'A bridge of old bone, bleached white. Tolls are paid in teeth.'],
    ['drowned_idol', 'The Drowned Idol', 'goblin_fens', 'poi', 0.83, 0.964, 'A statue up to its neck in the fen. Offerings float around it.', { danger: 2 }],
    ['bog_beacon', 'Bog Beacon', 'goblin_fens', 'poi', 0.848, 0.707, 'A tower of bones and reed that burns green at night.'],
    ['silt_wharf', 'Silt Wharf', 'river_cities', 'village', 0.553, 0.558, 'Barges unload by lantern light, and nobody asks what is under the grain.'],
    ['brassbell', 'Brassbell', 'river_cities', 'village', 0.479, 0.651, 'Guild bells ring the hours here, and the prices.'],
    ['gilded_ferry', 'Gilded Ferry', 'river_cities', 'village', 0.629, 0.652, 'The ferryman charges by the look of your purse.'],
    ['quillmark', 'Quillmark', 'river_cities', 'village', 0.514, 0.563, 'Scribes, forgers and the occasional honest notary.'],
    ['glasshaven', 'Glasshaven', 'iceflow', 'village', 0.799, 0.416, 'Glassblowers who make the lenses and wards the Spire runs on.'],
    ['wheatvale', 'Wheatvale', 'crownlands', 'village', 0.61, 0.368, 'Golden fields and a nervous reeve who has stopped trusting the tax rolls.'],
    ['applecourt', 'Applecourt', 'crownlands', 'village', 0.568, 0.298, 'Orchards, cider, and a manor whose lord has not been seen since spring.'],
    ['millstream', 'Millstream', 'crownlands', 'village', 0.526, 0.451, 'A mill, a chapel and a market day everyone still keeps.'],
    ['wardstone_green', 'Wardstone Green', 'voldun', 'village', 0.699, 0.652, 'A village built around a single, humming wardstone.'],
    ['quiet_bell', 'Quiet Bell', 'voldun', 'village', 0.861, 0.608, 'A bell-less bell tower. The villagers say it rings if someone lies.'],
    ['inkwell', 'Inkwell', 'voldun', 'village', 0.879, 0.543, 'Ink-makers and copyists, and a back-room printing press that should not exist.'],
    ['rendfield', 'Rendfield', 'orc_lands', 'village', 0.506, 0.758, 'A conquered farm town, now run by the people who conquered it.'],
    ['cinder_ford', 'Cinder Ford', 'orc_lands', 'village', 0.701, 0.71, 'A ford of warm black sand.'],
    ['basalt_camp', 'Basalt Camp', 'orc_lands', 'village', 0.653, 0.794, 'A camp of black-stone huts, quiet and watchful.'],
    ['stillhouse', 'The Stillhouse', 'goblin_fens', 'village', 0.755, 0.715, 'A distillery, an explosives shop and a fire door.', { owner: 'bilge_rats' }],
    ['stilthollow', 'Stilthollow', 'goblin_fens', 'village', 0.803, 0.809, 'A village on stilts. The Mire-Born see the whole fen from their roofs.', { owner: 'mire_born' }],
    ['reed_village', 'Reed Village', 'goblin_fens', 'village', 0.877, 0.842, 'A village that rebuilds itself after every flood.'],
    ['weighhouse', 'The Weighhouse', 'river_cities', 'hamlet', 0.456, 0.699, 'Every sack in the district is weighed here. The scales are not always honest.'],
    ['cask_hollow', 'Cask Hollow', 'river_cities', 'hamlet', 0.61, 0.528, 'Coopers and a smuggler\'s cellar, in that order of importance.'],
    ['willow_stair', 'Willow Stair', 'river_cities', 'hamlet', 0.414, 0.673, 'Wooden steps down to the water, and a boat for hire.'],
    ['chandlers_green', 'Chandler\'s Green', 'river_cities', 'hamlet', 0.579, 0.597, 'Candles, rope and rumour, all sold by weight.'],
    ['rimestair', 'Rimestair', 'iceflow', 'hamlet', 0.743, 0.289, 'A few huts at the foot of a frozen stair.'],
    ['quenchwater', 'Quenchwater', 'dwarven_holds', 'hamlet', 0.726, 0.208, 'A hot spring that the smiths use to cool their work.'],
    ['ploughmans_ford', 'Ploughman\'s Ford', 'crownlands', 'hamlet', 0.609, 0.321, 'A shallow ford, two farms and a very old dog.'],
    ['tithe_barn', 'Tithe Barn', 'crownlands', 'hamlet', 0.633, 0.478, 'A great barn, half empty this year.'],
    ['ragged_fence', 'Ragged Fence', 'free_marches', 'hamlet', 0.391, 0.15, 'The last fence the Crown still repairs.'],
    ['penitents_walk', 'Penitent\'s Walk', 'voldun', 'hamlet', 0.743, 0.612, 'A path of worn stones where the guilty walk barefoot.'],
    ['hedge_hollow', 'Hedge Hollow', 'voldun', 'hamlet', 0.806, 0.55, 'Unlicensed hedge-mages hide here. Everyone knows. Nobody says.'],
    ['synod_mill', 'Synod Mill', 'voldun', 'hamlet', 0.855, 0.527, 'A mill that grinds grain, paper and the occasional rumour.'],
    ['pale_vigil', 'Pale Vigil', 'voldun', 'hamlet', 0.711, 0.543, 'A watch-hamlet. The watch is always awake, and always afraid.'],
    ['raiders_beach', 'Raider\'s Beach', 'orc_lands', 'hamlet', 0.498, 0.831, 'Longships on the sand and a smell of tar.'],
    ['bonehall', 'Bonehall', 'orc_lands', 'hamlet', 0.438, 0.773, 'A feast hall made from the ribs of something very large.'],
    ['chain_road', 'Chain Road', 'orc_lands', 'hamlet', 0.452, 0.844, 'A fortified road-station where captives are counted.'],
    ['cooling_fields', 'The Cooling Fields', 'orc_lands', 'hamlet', 0.672, 0.845, 'Black fields where the lava has barely cooled and the orcs already farm.'],
    ['ember_tent', 'Ember Tent', 'orc_lands', 'hamlet', 0.696, 0.782, 'A tent of smoke-cured hide. Elders trade ash-charms here.'],
    ['traplines', 'The Traplines', 'goblin_fens', 'hamlet', 0.834, 0.858, 'A web of snares and string that only a Mire-Born can walk.', { owner: 'mire_born' }],
    ['leech_ford', 'Leech Ford', 'goblin_fens', 'hamlet', 0.763, 0.916, 'A shallow ford with a very good reason to hurry.'],
    ['frogsong', 'Frogsong', 'goblin_fens', 'hamlet', 0.786, 0.68, 'So loud at dusk that no one can think.'],
    ['wisp_hamlet', 'Wisp Isle', 'goblin_fens', 'hamlet', 0.907, 0.684, 'Lights over the water draw the unwary. The locals have learned to tell the difference.'],
    ['mist_trail', 'Mist Trail', 'goblin_fens', 'hamlet', 0.775, 0.851, 'A lonely path where lanterns are useless.'],
    ['rat_run', 'Rat Run', 'goblin_fens', 'hamlet', 0.924, 0.745, 'A smugglers\' warren under the reeds.', { owner: 'bilge_rats' }]
  ];
  NEWPLACES.forEach(([id, name, region, type, x, y, desc, ex]) => { if (C.NODES[id]) throw new Error('duplicate place ' + id); C.NODES[id] = Object.assign({ name, region, type, pos: [x, y], desc }, ex || {}); });
  const LAYOUT = {
    deepdelve: [0.52, 0.135, 'dwarven_holds'],
    ironforge: [0.58, 0.16, 'dwarven_holds'],
    crown_keep: [0.625, 0.42, 'crownlands'],
    sylvan_watch: [0.38, 0.43, 'elven_realms'],
    river_cities: [0.45, 0.645, 'river_cities'],
    voldun: [0.74, 0.565, 'voldun'],
    hammerrest: [0.449, 0.146, 'dwarven_holds'],
    stormbreak_hold: [0.753, 0.33, 'iceflow'],
    skyward_watch: [0.782, 0.222, 'iceflow'],
    hearthstone_priory: [0.596, 0.704, 'river_cities'],
    dunmere_keep: [0.575, 0.347, 'crownlands'],
    greywatch_post: [0.363, 0.227, 'free_marches'],
    thornwarden_keep: [0.513, 0.393, 'elven_realms'],
    sunwheel_chapel: [0.842, 0.55, 'voldun'],
    cinder_gate: [0.825, 0.517, 'voldun'],
    anvil_works: [0.683, 0.232, 'dwarven_holds'],
    glimmer_vein: [0.723, 0.147, 'dwarven_holds'],
    frostgate: [0.658, 0.141, 'dwarven_holds'],
    koestielve: [0.871, 0.431, 'iceflow'],
    frozen_ford: [0.801, 0.305, 'iceflow'],
    harrow_farms: [0.557, 0.491, 'crownlands'],
    rivermeet: [0.692, 0.444, 'crownlands'],
    wayfarers_rest: [0.376, 0.121, 'free_marches'],
    low_docks: [0.605, 0.659, 'river_cities'],
    stonebridge: [0.523, 0.697, 'river_cities'],
    greywater_landing: [0.418, 0.837, 'orc_lands'],
    stilt_market: [0.517, 0.915, 'orc_lands'],
    synod_gardens: [0.729, 0.65, 'voldun'],
    orchard_row: [0.683, 0.528, 'voldun'],
    brazier_peak: [0.623, 0.173, 'dwarven_holds'],
    giants_tooth: [0.486, 0.179, 'dwarven_holds'],
    frostmarch: [0.799, 0.471, 'iceflow'],
    golden_reach: [0.666, 0.376, 'crownlands'],
    free_marches: [0.329, 0.147, 'free_marches'],
    lowmeadows: [0.409, 0.179, 'free_marches'],
    elderwood: [0.348, 0.338, 'elven_realms'],
    greatwood: [0.446, 0.373, 'elven_realms'],
    mirefen: [0.57, 0.633, 'river_cities'],
    reed_marsh: [0.635, 0.802, 'orc_lands'],
    ashfall_reach: [0.695, 0.751, 'orc_lands'],
    obsidian_terraces: [0.672, 0.807, 'orc_lands'],
    saltmere: [0.87, 0.915, 'goblin_fens'],
    hollow_deep: [0.417, 0.119, 'dwarven_holds'],
    mine_collapse: [0.487, 0.116, 'dwarven_holds'],
    river_watch: [0.741, 0.396, 'iceflow'],
    old_milestone: [0.537, 0.307, 'crownlands'],
    bandit_ford: [0.39, 0.246, 'free_marches'],
    whispering_glade: [0.377, 0.53, 'elven_realms'],
    heartwood_trail: [0.344, 0.475, 'elven_realms'],
    felled_grove: [0.399, 0.337, 'elven_realms'],
    mosswood_camp: [0.336, 0.423, 'elven_realms'],
    thornfield: [0.436, 0.536, 'elven_realms'],
    ashen_obelisk: [0.662, 0.745, 'orc_lands'],
    deeproot_mines: [0.66, 0.281, 'dwarven_holds'],
    runefall: [0.553, 0.114, 'dwarven_holds'],
    ember_gallery: [0.654, 0.202, 'dwarven_holds'],
    snowmelt_tarn: [0.837, 0.458, 'iceflow'],
    frozen_falls: [0.768, 0.281, 'iceflow'],
    wolfmothers_den: [0.753, 0.186, 'iceflow'],
    last_cairn: [0.863, 0.489, 'iceflow'],
    beacon_hill: [0.593, 0.282, 'crownlands'],
    whitestone_abbey: [0.659, 0.47, 'crownlands'],
    carrow_tower: [0.443, 0.207, 'free_marches'],
    widows_barrow: [0.375, 0.178, 'free_marches'],
    hermits_rime: [0.421, 0.443, 'elven_realms'],
    moonwell: [0.483, 0.424, 'elven_realms'],
    highspire_rest: [0.479, 0.35, 'elven_realms'],
    glass_hollow: [0.445, 0.308, 'elven_realms'],
    mooncircle: [0.374, 0.298, 'elven_realms'],
    sentinel_ring: [0.397, 0.482, 'elven_realms'],
    outlaws_rest: [0.472, 0.27, 'free_marches'],
    glasswood_spires: [0.36, 0.392, 'elven_realms'],
    greycrown_peak: [0.452, 0.586, 'river_cities'],
    drowned_chapel: [0.606, 0.598, 'river_cities'],
    lantern_point: [0.56, 0.97, 'orc_lands'],
    heron_hide: [0.46, 0.28, 'free_marches'],
    vent_hollow: [0.68, 0.709, 'orc_lands'],
    brimstone_chapel: [0.697, 0.812, 'orc_lands'],
    reliquary_hill: [0.72, 0.508, 'voldun'],
    sinkhole_shrine: [0.891, 0.741, 'goblin_fens'],
    pickaxe_row: [0.605, 0.121, 'dwarven_holds'],
    stonehearth: [0.545, 0.178, 'dwarven_holds'],
    rimewater: [0.803, 0.187, 'iceflow'],
    kingsway_cross: [0.703, 0.39, 'crownlands'],
    pennant_green: [0.724, 0.455, 'crownlands'],
    driftmoor_farm: [0.345, 0.182, 'free_marches'],
    hobbs_reach: [0.409, 0.22, 'free_marches'],
    cradlepine: [0.45, 0.421, 'elven_realms'],
    bramblewick: [0.424, 0.491, 'elven_realms'],
    tanglewick: [0.374, 0.352, 'elven_realms'],
    tollhouse_quay: [0.623, 0.689, 'river_cities'],
    barley_wharf: [0.57, 0.908, 'orc_lands'],
    copperfield: [0.608, 0.97, 'orc_lands'],
    peat_cuts: [0.684, 0.959, 'orc_lands'],
    pilgrims_stair: [0.753, 0.509, 'voldun'],
    marshlight: [0.739, 0.871, 'goblin_fens'],
    kettle_stair: [0.595, 0.217, 'dwarven_holds'],
    coldspring_lodge: [0.717, 0.27, 'dwarven_holds'],
    whitepine_lodge: [0.798, 0.261, 'iceflow'],
    elk_meadow: [0.779, 0.323, 'iceflow'],
    sheepfold: [0.55, 0.357, 'crownlands'],
    duskwater_mill: [0.53, 0.516, 'crownlands'],
    millers_weir: [0.651, 0.414, 'crownlands'],
    gullsong: [0.357, 0.147, 'free_marches'],
    thistledown: [0.37, 0.478, 'elven_realms'],
    seedwatch: [0.423, 0.336, 'elven_realms'],
    rootbridge: [0.405, 0.531, 'elven_realms'],
    foxhallow: [0.467, 0.387, 'elven_realms'],
    bogwater: [0.609, 0.749, 'orc_lands'],
    cantors_rest: [0.77, 0.583, 'voldun'],
    sandwatch: [0.94, 0.865, 'goblin_fens'],
    reedwife: [0.73, 0.762, 'goblin_fens'],
    iceflow_road: [0.765, 0.399, 'iceflow'],
    salt_road: [0.5, 0.679, 'river_cities'],
    eastern_pass: [0.822, 0.679, 'goblin_fens']
  };
  const KEEP_OWNER = { greywater_landing: 'syndicate', stilt_market: 'syndicate', hearthstone_priory: 'hearthwatch', drowned_chapel: 'hearthwatch', brimstone_chapel: 'hearthwatch', outlaws_rest: 'broken_banner', widows_barrow: 'broken_banner', heron_hide: 'broken_banner' }; // Syndicate trading enclaves inside orc country
  Object.entries(LAYOUT).forEach(([id, [x, y, region]]) => {
    const n = C.NODES[id]; if (!n) throw new Error('LAYOUT: unknown ' + id);
    if (n.region !== region) delete n.owner;
    n.region = region; n.pos = [x, y]; delete n.land; if (KEEP_OWNER[id]) n.owner = KEEP_OWNER[id];
  });
  if (C.NODES.millstream) C.NODES.millstream.owner = 'hearthwatch'; // its chapel is a Hearthwatch house
  // The Spinepeak is the high elves' land: three places the old layout left with the Ironbound belong to the Ivory Spire now (v4.4).
  Object.assign(C.NODES.stormbreak_hold, { owner: 'ivory', faction: 'ivory' }); Object.assign(C.NODES.skyward_watch, { owner: 'ivory', faction: 'ivory' }); C.NODES.koestielve.owner = 'ivory';
  const RENAME = { river_cities: 'Gildhaven', highspire_rest: 'The High Perch', hermits_rime: 'Hermit\'s Hollow', stormbreak_hold: 'The Ivory Spire', reed_marsh: 'Reedmarch', mirefen: 'The Mirefen', ashfall_reach: 'Ashfall Reach' };
  Object.entries(RENAME).forEach(([id, name]) => { if (C.NODES[id]) C.NODES[id].name = name; });
  // Names and descriptions fitted to the new map (v4.2): no fens or lava in the Rusted Wastes, no volcano by Vol'Dun, the forest now east of the plains.
  const GEO = {"gullsong": ["Larksong", "Hill herders on the windy downs under Frostpeak."], "cinder_gate": ["Thornwatch Gate", "The Synod’s fortress on the edge of the Silvan Thicket. They watch the trees, and the trees watch back."], "skyward_watch": [null, "The Spire’s northern lookout, higher than the clouds on most days."], "stormbreak_hold": [null, "The high elves’ white tower on a spur of the Spinepeak, taking the worst of every storm."], "koestielve": [null, "A border market where elven glass meets human coin."], "iceflow_road": [null, "The cold road along the river, down from the high passes to the plains."], "last_cairn": [null, "A cairn at the southern end of the Spinepeak, where the mountains meet the sea. Travellers add stones."], "frostgate": [null, "The gatehouse where the holds meet the forest road. Guards check every cart twice."], "greatwood": [null, "The deep heart of the Thicket. Trails shift, and so do the people on them."], "glass_hollow": [null, "A crater where lightning once fused the sand into green glass."], "glasswood_spires": [null, "Tall, pale trees along the eastern shore that ring like glass in the wind."], "hermits_rime": [null, "A hut of driftwood and moss. The old woman inside trades in rumours."], "thornfield": [null, "Burned clearings and a raider camp in the thorn thickets."], "eastern_pass": ["The Causeway", "A raised causeway into the fen. Few go further than the last marker stone."], "sandwatch": [null, "A few mud-brick huts on a sand bar, watching the sea."], "lantern_point": [null, "A lighthouse the Legion took from four merchant houses. It still burns, for the raiders now."], "greywater_landing": [null, "A walled Syndicate trading post, the last safe stop before the Wastes."], "stilt_market": ["Dust Market", "A Syndicate market of carts and awnings that moves a little each season."], "barley_wharf": ["Grainpit", "Granaries dug into the rock, and a fierce porters’ guild that answers to the Legion."], "bogwater": ["Redwell", "A muddy well and a dozen huts. The water runs red and nobody complains."], "heron_hide": ["Hawk Hide", "A hunters’ blind on a high ridge, with a view across the Marches. The Banner’s riders use it to watch the roads."], "reed_marsh": ["Redmarch", "A track through red canyons. Easy to lose a cart here, easier to lose a person."], "peat_cuts": ["Ochre Cuts", "Ochre diggers’ village, and a long way from anywhere."], "copperfield": [null, "Copper diggings and a foundry that runs day and night."], "molten_run": ["Rust Run", "A dry riverbed of red grit. Orcs race their wolves down it on dares."], "ashfall_reach": ["Dustfall Reach", "Red dust falls like snow here when the wind turns. Few people live and fewer stay."], "obsidian_terraces": ["The Red Terraces", "Stepped red mesas crossing the desert. Sharp, and bright in sunlight."], "cooling_fields": ["The Burnt Fields", "Scorched fields where the orcs farm what little will grow."], "cinder_ford": ["Rust Ford", "A ford of red sand, where a thin river runs for half the year."], "basalt_camp": ["Mesa Camp", "A camp of red-stone huts under a mesa, quiet and watchful."], "raiders_beach": ["Raiders’ Camp", "War-wagons drawn up on the sand and a smell of tar."], "embers_hearth": [null, "A cave-hall deep in a mesa, where shamans read the ashes of the dead."]};
  Object.entries(GEO).forEach(([id, [name, desc]]) => { const n = C.NODES[id]; if (!n) throw new Error('GEO: unknown ' + id); if (name) n.name = name; if (desc) n.desc = desc; });
  // Place types (v4.3): ten kinds, each drawn differently on the map. Halls are castles that take oaths (seat: true);
  // set battles, story scenes and the contested Free Marches are points of interest (what happens there is shown by its markers).
  const FOLD = { hall: 'castle', battle: 'poi', choice: 'poi', contested: 'poi' };
  Object.values(C.NODES).forEach(n => { if (!FOLD[n.type]) return; if (n.type === 'hall') n.seat = true; n.was = n.type; n.type = FOLD[n.type]; });
  C.PLACE_TYPES = ['capital', 'castle', 'market', 'town', 'village', 'hamlet', 'poi', 'zone', 'road', 'dungeon'];
  C.PARKED = {};
  ['port_vane', 'rimecap_reach', 'gull_light', 'lone_beacon', 'kestrel_rock', 'whitepan', 'fernmouth', 'pearl_shallows', 'tidemother_shrine', 'kelp_market', 'drowned_orchard', 'skerry_rest', 'reefwatch', 'wreckers_cove', 'whitepan_landing', 'fishers_ledge'].forEach(id => { if (!C.NODES[id]) throw new Error('PARKED: unknown ' + id); C.PARKED[id] = C.NODES[id]; delete C.NODES[id]; });
  // Everything inside a faction's region defaults to that faction's territory (the Free Marches belong to nobody).
  Object.values(C.NODES).forEach(n => { const r = C.REGIONS[n.region]; if (!n.owner && r && r.faction && n.region !== 'free_marches') n.owner = r.faction; });

  // ---- World layout v4: every place on the new painted map. Positions were spread evenly over each territory, keeping each place
  //      where it stood relative to its neighbours on the old map (tools: tools/layout.py). Border stops and dungeons are included. ----
  C.MAP_POS = {"bandit_ford":[0.4601,0.2965],"free_marches":[0.4167,0.2832],"wayfarers_rest":[0.5101,0.2367],"gullsong":[0.4326,0.2793],"driftmoor_farm":[0.4014,0.3059],"carrow_tower":[0.5283,0.2726],"widows_barrow":[0.4493,0.2553],"lowmeadows":[0.4957,0.242],"hobbs_reach":[0.4899,0.3005],"greywatch_post":[0.4217,0.3098],"marchwardens_post":[0.5145,0.2965],"hungry_mile":[0.5457,0.2952],"gallows_hill":[0.5174,0.1636],"ragged_fence":[0.5123,0.2593],"stonebridge":[0.5565,0.8604],"river_cities":[0.4783,0.6941],"low_docks":[0.5543,0.8072],"tollhouse_quay":[0.5899,0.871],"greycrown_peak":[0.4355,0.625],"drowned_chapel":[0.5652,0.7314],"mirefen":[0.5362,0.7394],"hearthstone_priory":[0.5732,0.8816],"ledgerhall":[0.5797,0.6729],"debtors_tower":[0.5283,0.6888],"grain_exchange":[0.4659,0.6755],"canalgate":[0.537,0.6676],"mercers_row":[0.558,0.8391],"tollbridge_camp":[0.492,0.7753],"barge_landing":[0.5138,0.6941],"fogwater":[0.5536,0.7793],"old_toll":[0.4449,0.6902],"bargemans_cairn":[0.5239,0.8045],"silt_wharf":[0.521,0.6569],"brassbell":[0.513,0.7247],"gilded_ferry":[0.571,0.8019],"weighhouse":[0.5246,0.7566],"cask_hollow":[0.5609,0.6529],"old_milestone":[0.4471,0.3843],"crown_keep":[0.4899,0.4721],"harrow_farms":[0.4674,0.5106],"beacon_hill":[0.4899,0.3404],"kingsway_cross":[0.5065,0.4535],"sheepfold":[0.4464,0.4229],"rivermeet":[0.5043,0.4747],"whitestone_abbey":[0.4783,0.5293],"dunmere_keep":[0.4667,0.387],"golden_reach":[0.5152,0.4069],"duskwater_mill":[0.471,0.4827],"pennant_green":[0.5,0.504],"aldermere_hold":[0.4275,0.4016],"heralds_cross":[0.4297,0.375],"crownwatch_inn":[0.4783,0.3577],"pilgrims_well":[0.4275,0.4428],"muster_field":[0.4667,0.4535],"hollow_fields":[0.4819,0.5],"oath_cairn":[0.4188,0.3364],"kings_barrow":[0.4341,0.4668],"signal_tower":[0.4312,0.5758],"wheatvale":[0.4623,0.4162],"applecourt":[0.4399,0.3617],"millstream":[0.4341,0.4242],"ploughmans_ford":[0.4739,0.4122],"tithe_barn":[0.4949,0.6051],"voldun":[0.5594,0.4508],"synod_gardens":[0.5464,0.516],"orchard_row":[0.5428,0.4162],"pilgrims_stair":[0.5601,0.363],"sunwheel_chapel":[0.6065,0.4335],"reliquary_hill":[0.521,0.3644],"cinder_gate":[0.5812,0.3617],"ash_court":[0.6036,0.496],"blackstone_archive":[0.5333,0.4973],"lampwright_street":[0.6362,0.4428],"scriptorium_row":[0.6159,0.5106],"lamplighters_rest":[0.5877,0.5093],"long_stair":[0.6145,0.5545],"pyre_field":[0.5507,0.4894],"sunken_cloister":[0.6159,0.4654],"wardstone_green":[0.5435,0.6051],"pale_vigil":[0.5536,0.4269],"hollow_deep":[0.3855,0.0652],"deepdelve":[0.4507,0.0811],"ironforge":[0.5217,0.0824],"anvil_works":[0.5616,0.0997],"glimmer_vein":[0.6123,0.0997],"mine_collapse":[0.4094,0.0944],"frostgate":[0.5645,0.0785],"kettle_stair":[0.4645,0.1503],"deeproot_mines":[0.4246,0.2301],"runefall":[0.4652,0.0612],"hammerrest":[0.3761,0.1223],"coldspring_lodge":[0.5862,0.1503],"pickaxe_row":[0.542,0.0798],"ember_gallery":[0.6072,0.1795],"brazier_peak":[0.579,0.0731],"giants_tooth":[0.3819,0.1968],"stonehearth":[0.4007,0.1503],"cogsmith_row":[0.542,0.1503],"bellows_gate":[0.6217,0.1848],"oathstone":[0.6565,0.1223],"quenchwater":[0.5978,0.1503],"iceflow_road":[0.4283,0.7021],"koestielve":[0.3862,0.6064],"frozen_ford":[0.3957,0.5293],"river_watch":[0.4522,0.7354],"skyward_watch":[0.363,0.3178],"rimewater":[0.3486,0.2859],"stormbreak_hold":[0.4087,0.5878],"whitepine_lodge":[0.3667,0.3497],"snowmelt_tarn":[0.3899,0.7008],"frozen_falls":[0.3841,0.4242],"frostmarch":[0.3993,0.7686],"elk_meadow":[0.3848,0.5598],"wolfmothers_den":[0.3638,0.1915],"last_cairn":[0.3732,0.6862],"silverdeep_gate":[0.4,0.6157],"frost_archive":[0.4181,0.75],"lantern_terrace":[0.3761,0.379],"low_winter_court":[0.4145,0.613],"fading_wards":[0.3261,0.3019],"starfall_tarn":[0.2928,0.2979],"glasshaven":[0.3957,0.641],"rimestair":[0.4036,0.5625],"thornfield":[0.7,0.5811],"whispering_glade":[0.7993,0.5199],"heartwood_trail":[0.8159,0.5146],"sylvan_watch":[0.787,0.2753],"felled_grove":[0.7514,0.1888],"mosswood_camp":[0.8449,0.4295],"hermits_rime":[0.7203,0.4242],"cradlepine":[0.6652,0.4521],"thornwarden_keep":[0.5884,0.2832],"elderwood":[0.8399,0.1662],"bramblewick":[0.6783,0.4814],"thistledown":[0.7855,0.3963],"moonwell":[0.6246,0.371],"highspire_rest":[0.6123,0.2327],"glass_hollow":[0.663,0.0851],"seedwatch":[0.742,0.2207],"greatwood":[0.6783,0.1835],"mooncircle":[0.779,0.1436],"tanglewick":[0.7877,0.3032],"rootbridge":[0.7029,0.5133],"foxhallow":[0.6348,0.2673],"sentinel_ring":[0.737,0.496],"outlaws_rest":[0.472,0.27],"glasswood_spires":[0.8442,0.2872],"wardens_lodge":[0.6652,0.508],"dewfall_glade":[0.5406,0.2234],"eastern_pass":[0.6616,0.5918],"sandwatch":[0.808,0.6702],"saltmere":[0.8109,0.8191],"reedwife":[0.6449,0.6383],"marshlight":[0.637,0.7035],"sinkhole_shrine":[0.758,0.5771],"fusehouse":[0.7957,0.5705],"mudcrown":[0.6971,0.6449],"bilgeport":[0.6304,0.6489],"powder_row":[0.6652,0.6649],"toadstool_market":[0.7696,0.6157],"quicklime_pits":[0.8435,0.5106],"rotwood":[0.5797,0.7394],"the_sump":[0.6152,0.6237],"sulphur_springs":[0.6109,0.7926],"bubbling_vats":[0.8232,0.613],"bone_bridge":[0.8355,0.8338],"drowned_idol":[0.6623,0.8098],"bog_beacon":[0.7152,0.5971],"stillhouse":[0.6674,0.6277],"stilthollow":[0.6848,0.6582],"reed_village":[0.7268,0.6436],"traplines":[0.7159,0.7606],"leech_ford":[0.5891,0.766],"frogsong":[0.6565,0.617],"wisp_hamlet":[0.7732,0.5824],"mist_trail":[0.6072,0.6742],"rat_run":[0.8029,0.5944],"greywater_landing":[0.2167,0.4202],"reed_marsh":[0.258,0.5811],"ashen_obelisk":[0.3725,0.5093],"barley_wharf":[0.1341,0.5199],"lantern_point":[0.0899,0.4162],"copperfield":[0.1022,0.5545],"bogwater":[0.2551,0.5519],"stilt_market":[0.1493,0.512],"peat_cuts":[0.1514,0.7301],"heron_hide":[0.485,0.195],"ashfall_reach":[0.3391,0.6356],"vent_hollow":[0.3609,0.5838],"brimstone_chapel":[0.2406,0.8311],"obsidian_terraces":[0.2319,0.6822],"bloodforge":[0.1094,0.6343],"tusk_gate":[0.1326,0.5638],"embers_hearth":[0.15,0.7859],"slagmarket":[0.1703,0.4721],"molten_run":[0.2014,0.5572],"warbanner_hill":[0.3478,0.3949],"skull_quarry":[0.2964,0.3989],"ash_stair":[0.2717,0.6449],"vent_of_the_dead":[0.1572,0.609],"rendfield":[0.2514,0.4694],"cinder_ford":[0.2572,0.7301],"basalt_camp":[0.2138,0.5731],"raiders_beach":[0.1899,0.4747],"bonehall":[0.2283,0.4681],"chain_road":[0.1812,0.4588],"cooling_fields":[0.2101,0.7207],"ember_tent":[0.2036,0.7566],"lamp_stairs":[0.529,0.1848],"slag_track":[0.3739,0.1689],"root_stair":[0.6471,0.0918],"boundary_elm":[0.4312,0.5465],"scribes_post":[0.4275,0.6729],"ash_verge":[0.3652,0.5359],"saltpan_row":[0.2949,0.3484],"fallow_gate":[0.4362,0.3231],"dry_culvert":[0.5196,0.3245],"kings_mile":[0.5406,0.2527],"harvest_road":[0.5304,0.3976],"willow_flats":[0.5109,0.6104],"arch_mile":[0.558,0.6184],"greenway_ford":[0.6493,0.4601],"herb_terrace":[0.6145,0.5891],"burnt_ford":[0.5884,0.7141],"brackenway":[0.7145,0.5678],"rat_run_warren":[0.8145,0.5944],"old_toll_cellars":[0.4449,0.6689],"thistledown_well":[0.7739,0.3963],"frozen_falls_cave":[0.3841,0.4029],"drowned_idol_depths":[0.6616,0.7886],"sunken_cloister_crypt":[0.6152,0.4441],"silt_wharf_undercroft":[0.5094,0.6556],"applecourt_cellars":[0.4406,0.3404],"skull_quarry_pits":[0.308,0.4003],"oathstone_crypt":[0.6449,0.121],"kings_barrow_depths":[0.4333,0.488],"bubbling_vats_undercellar":[0.8116,0.613],"bonehall_pit":[0.2283,0.4894],"fading_wards_vault":[0.3268,0.3231]};
  C.applyMapPos = () => Object.entries(C.MAP_POS).forEach(([id, p]) => { const n = C.NODES[id]; if (n) { n.pos = [p[0], p[1]]; delete n.land; } });
  C.applyMapPos();
  // Places with nothing in them (no shop, fight, scene, quest or story) were cut from the human lands; the towns nearby keep their taverns.
  C.RETIRED = ['salt_road', 'millers_weir', 'cantors_rest', 'chantry_of_names', 'willow_stair', 'chandlers_green', 'penitents_walk', 'hedge_hollow', 'synod_mill', 'harvest_cross', 'pennywise_inn', 'inquisitors_rest', 'quillmark', 'quiet_bell', 'inkwell'];
  C.RETIRED.forEach(id => { if (!C.NODES[id]) throw new Error('RETIRED: unknown ' + id); delete C.NODES[id]; });
  // an old save standing at a cut place wakes at the nearest place that remains
  C.RETIRED_TO = {'salt_road': 'tollbridge_camp', 'millers_weir': 'ploughmans_ford', 'cantors_rest': 'ash_court', 'chantry_of_names': 'blackstone_archive', 'willow_stair': 'brassbell', 'chandlers_green': 'canalgate', 'penitents_walk': 'voldun', 'hedge_hollow': 'voldun', 'synod_mill': 'cinder_gate', 'harvest_cross': 'gilded_ferry', 'pennywise_inn': 'gilded_ferry', 'inquisitors_rest': 'pale_vigil', 'quillmark': 'river_cities', 'quiet_bell': 'scriptorium_row', 'inkwell': 'lampwright_street'};
  C.fixLocation = st => { const l = st && st.world && st.world.location; if (l && !C.NODES[l]) { st.world.location = C.RETIRED_TO[l] || 'kingsway_cross'; (st.world.nodes[st.world.location] = st.world.nodes[st.world.location] || {}).discovered = true; } return st; };

  // ---- roads inside each territory: routes, not a mesh. Two places are joined only if no third place is nearer to both
  //      (a relative neighbourhood graph); a shortcut is added back where the road would otherwise wind 4 or more days
  //      around; pieces left apart are bridged by their closest pair. Every hop takes one day. ----
  C.EDGES = [];
  (function () {
    const zones = {};
    Object.entries(C.NODES).forEach(([id, n]) => { (zones[n.region] = zones[n.region] || []).push(id); });
    const P = id => [C.NODES[id].pos[0] * 1380, C.NODES[id].pos[1] * 752], d2 = (a, b) => { const p = P(a), q = P(b); return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; };
    Object.values(zones).forEach(ids => {
      const gab = [], E = [], adj = {}; ids.forEach(i => { adj[i] = new Set(); });
      const join = (a, b) => { E.push([a, b]); adj[a].add(b); adj[b].add(a); };
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j], dab = d2(a, b); if (Math.sqrt(dab) > 230) continue;
        if (!ids.some(c => c !== a && c !== b && d2(a, c) + d2(c, b) < dab)) gab.push([a, b, dab]);
      }
      gab.forEach(([a, b, dab]) => { if (!ids.some(c => c !== a && c !== b && Math.max(d2(a, c), d2(b, c)) < dab)) join(a, b); });
      const hops = (a, b) => { const seen = { [a]: 0 }, q = [a]; while (q.length) { const x = q.shift(); if (x === b) return seen[x]; adj[x].forEach(y => { if (!(y in seen)) { seen[y] = seen[x] + 1; q.push(y); } }); } return 99; };
      gab.slice().sort((x, y) => x[2] - y[2]).forEach(([a, b]) => { if (!adj[a].has(b) && hops(a, b) >= 4) join(a, b); });
      const comp = {}; ids.forEach(i => { comp[i] = i; }); const find = x => (comp[x] === x ? x : (comp[x] = find(comp[x])));
      E.forEach(([a, b]) => { comp[find(a)] = find(b); });
      for (;;) { // bridge any separate pieces by their closest pair
        const roots = new Set(ids.map(find)); if (roots.size <= 1) break;
        let best = null; ids.forEach(a => ids.forEach(b => { if (find(a) !== find(b)) { const d = d2(a, b); if (!best || d < best[0]) best = [d, a, b]; } }));
        join(best[1], best[2]); comp[find(best[1])] = find(best[2]);
      }
      E.forEach(([a, b]) => C.EDGES.push([a, b, 1]));
    });
  })();

  // ---- roads between regions: always a chain of stops, so no region is ever crossed in one move ----
  // [from, to, [[id, name, region, type, description, shop?], ...]]  (each hop is 1 day)
  C.ROUTES = [
    ["cogsmith_row", "gallows_hill", [["lamp_stairs", "Lamp Stairs", "free_marches", 'road', "A switchback stair cut into the cliff, lit by guild lamps."]]],
    ["giants_tooth", "wolfmothers_den", [["slag_track", "Slag Track", "dwarven_holds", 'road', "A cart track of black slag, lined with spent lamps."]]],
    ["oathstone", "glass_hollow", [["root_stair", "Root Stair", "elven_realms", 'road', "Pine roots make a stair down from the snowline into the Thicket. The dwarves count the steps; the elves do not."]]],
    ["stormbreak_hold", "signal_tower", [["boundary_elm", "Boundary Elm", "crownlands", 'road', "A great elm marking the Crown’s western boundary. Writs are nailed to it."]]],
    ["iceflow_road", "old_toll", [["scribes_post", "Scribe's Post", "iceflow", 'road', "Spire scribes record every traveller who comes up from the river towns."]]],
    ["frozen_ford", "ashen_obelisk", [["ash_verge", "Ash Verge", "orc_lands", 'road', "Red dust blows in drifts here. The Spire and the Legion both claim the road."]]],
    ["starfall_tarn", "skull_quarry", [["saltpan_row", "Saltpan Row", "orc_lands", 'road', "White salt pans glittering below the Spinepeak, raked by silent workers."]]],
    ["greywatch_post", "oath_cairn", [["fallow_gate", "Fallow Gate", "free_marches", 'road', "A broken gate in a field nobody farms any more."]]],
    ["marchwardens_post", "reliquary_hill", [["dry_culvert", "Dry Culvert", "free_marches", 'road', "A stone culvert over a stream that dried up years ago."]]],
    ["carrow_tower", "dewfall_glade", [["kings_mile", "King's Mile", "elven_realms", 'road', "The Crown’s best road, paved for a mile and then not at all."]]],
    ["golden_reach", "orchard_row", [["harvest_road", "Harvest Road", "voldun", 'road', "Granary carts rattle east along here every autumn."]]],
    ["tithe_barn", "silt_wharf", [["willow_flats", "Willow Flats", "crownlands", 'road', "Low ground and drooping willows. The road is mostly mud."]]],
    ["cask_hollow", "wardstone_green", [["arch_mile", "Arch Mile", "voldun", 'road', "A causeway of ancient arches, half of them patched with new stone."]]],
    ["lampwright_street", "cradlepine", [["greenway_ford", "Greenway Ford", "voldun", 'road', "A shallow ford where the fields end and the Thicket begins."]]],
    ["long_stair", "the_sump", [["herb_terrace", "Herb Terrace", "goblin_fens", 'road', "Terraces of herbs where the dry ground gives way to the fen."]]],
    ["drowned_chapel", "rotwood", [["burnt_ford", "Burnt Ford", "goblin_fens", 'road', "A ford of charred timbers, where Syndicate barges and goblin rafts meet to trade and threaten."]]],
    ["thornfield", "bog_beacon", [["brackenway", "Brackenway", "elven_realms", 'road', "Bracken taller than a man, and a path that keeps moving. The forest gives way to the fen here."]]]
  ];
  (function () {
    C.ROUTES.forEach(([a, b, stops]) => {
      const A = C.NODES[a], B = C.NODES[b]; if (!A || !B) throw new Error('route endpoint missing: ' + a + ' ' + b);
      const n = stops.length, W = 1376 / 768, dx = (B.pos[0] - A.pos[0]) * W, dy = B.pos[1] - A.pos[1], len = Math.hypot(dx, dy) || 1;
      const chain = [a].concat(stops.map(x => x[0]), [b]);
      stops.forEach((st, i) => {
        const t = (i + 1) / (n + 1), off = st[3] === 'sea' ? 0 : (i % 2 ? 1 : -1) * 0.012; // roads wiggle a little, sea lanes do not
        const x = A.pos[0] + (B.pos[0] - A.pos[0]) * t + (-dy / len) * off / W, y = A.pos[1] + dy * t + (dx / len) * off;
        if (C.NODES[st[0]]) throw new Error('duplicate stop ' + st[0]);
        C.NODES[st[0]] = { name: st[1], region: st[2], type: st[3], pos: [+x.toFixed(3), +y.toFixed(3)], desc: st[4], route: true };
        if (st[5]) C.NODES[st[0]].shop = st[5];
      });
      for (let i = 0; i < chain.length - 1; i++) C.EDGES.push([chain[i], chain[i + 1], 1]);
    });
  })();
  (function () { // keep road stops clear of the places around them
    const R = 60, stops = Object.keys(C.NODES).filter(i => C.NODES[i].route), all = Object.keys(C.NODES), px = id => [C.NODES[id].pos[0] * 2866, C.NODES[id].pos[1] * 1600];
    for (let it = 0; it < 80; it++) {
      let moved = false;
      stops.forEach(a => all.forEach(b => {
        if (a === b) return;
        const p = px(a), q = px(b), dx = p[0] - q[0] || 0.01, dy = p[1] - q[1] || 0.01, d = Math.hypot(dx, dy);
        if (d < R) { const k = (R - d) / d * (C.NODES[b].route ? 0.5 : 1); C.NODES[a].pos = [(p[0] + dx * k) / 2866, (p[1] + dy * k) / 1600]; moved = true; }
      }));
      if (!moved) break;
    }
    stops.forEach(id => { const p = C.NODES[id].pos; C.NODES[id].pos = [+p[0].toFixed(3), +p[1].toFixed(3)]; });
  })();
  C.applyMapPos();   // border stops sit where the map layout put them
  Object.values(C.NODES).forEach(n => { n.links = {}; });
  C.EDGES.forEach(([a, b, d]) => { C.NODES[a].links[b] = d; C.NODES[b].links[a] = d; });


  C.ENCOUNTERS = {
    bandit_ford: { name: 'Bandit Ford', map: 'bandit_ford', rec: 2, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'squire', name: 'Deserter' }, { primary: 'scout', name: 'Ford Archer' }, { primary: 'apprentice', name: 'Hedge Mage' }],
      reward: { xp: 70, gold: 60 } },
    iceflow_ambush: { name: 'Iceflow Ambush', map: 'iceflow_ambush', rec: 3, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'rogue', name: 'Road Knife' }, { primary: 'scout', name: 'Snow Archer' }, { primary: 'squire', name: 'Brigand' }],
      objective: { type: 'survive', turns: 5 },
      reward: { xp: 90, gold: 50, items: { vigor_ring: 1 } } },
    marches_defence: { name: 'Raiders at the Marches', map: 'marches_defence', rec: 5, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'warrior', name: 'Raider Captain' }, { primary: 'archer', name: 'Raider Bowman' }, { primary: 'rogue', name: 'Raider Knife' }],
      objective: { type: 'hold', zone: 'centre', size: 2, turns: 3, limit: 10, label: 'Hold the gate' },
      reward: { xp: 120, gold: 90 } },
    felled_grove: { name: 'Felled Grove', map: 'felled_grove', rec: 6, once: true,
      options: [
        { id: 'help_crown', label: 'Escort the loggers (fight the Wardens)', enemyFaction: 'canopy', standing: { crown: 40, canopy: -20 },
          enemies: [{ primary: 'tracker', name: 'Warden Tracker' }, { primary: 'druid', name: 'Warden Druid' }, { primary: 'scout', name: 'Warden Scout' }], reward: { xp: 130, gold: 80 } },
        { id: 'help_wardens', label: 'Stop the loggers (fight the Crown)', enemyFaction: 'crown', standing: { canopy: 40, crown: -20 },
          enemies: [{ primary: 'warrior', name: 'Crown Guard' }, { primary: 'archer', name: 'Crown Bowman' }, { primary: 'squire', name: 'Crown Recruit' }], reward: { xp: 130, gold: 40, items: { traveler_boots: 1 } } }
      ] },
    vane_smugglers: { name: 'Port Vane Smugglers', map: 'vane_smugglers', rec: 5, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'rogue', name: 'Cutpurse' }, { primary: 'rogue', name: 'Knife Hand' }, { primary: 'shaman', name: 'Hex Dealer' }],
      objective: { type: 'leader', leader: 2 },
      reward: { xp: 120, gold: 100 } },
    forge_trial: { name: 'Forge Trial', map: 'forge_trial', rec: 7, enemyFaction: 'anvil', once: true,
      enemies: [{ primary: 'bulwark', name: 'Guild Shieldhand' }, { primary: 'marksman', name: 'Guild Sapper' }, { primary: 'cleric', name: 'Guild Medic' }],
      objective: { type: 'reach', zone: 'centre', size: 1, limit: 10, label: 'Reach the forge crown' },
      reward: { xp: 140, gold: 70, items: { crossbow: 1 } } }
  };

  C.CHOICES = {
    mine_collapse: { text: 'Rubble blocks the collapsed gallery. Somewhere behind it are six miners nobody expects to see again.\n\nIronbound clansmen stand with lamps and want it sealed today, as a grave, with the old words said over it. The Anvil Guild\'s engineers have brought picks, and point out that the richest seam in Deepdelve runs right through it.',
      options: [
        { id: 'seal', label: 'Help the clans seal it as a grave', hint: 'The Ironbound will remember. The Guild loses its seam.', standing: { ironbound: 60, anvil: -30 }, flag: 'gallery_sealed' },
        { id: 'dig', label: 'Help the engineers dig through', hint: 'Guild coin, and a share. The clans will call it grave-robbing.', standing: { anvil: 60, ironbound: -40 }, gold: 80, flag: 'gallery_dug', relations: [['ironbound', 'anvil', -0.15, true]] },
        { id: 'leave', label: 'Leave them to argue', hint: 'Neither side thanks you.', flag: 'gallery_ignored' }
      ] }
  };

  // More story fights, one or two per region, at rising levels. All are once-only; the road itself adds random ones (see rollWander).
  Object.assign(C.ENCOUNTERS, {
    heartwood_poachers: { name: 'Heartwood Poachers', map: 'heartwood_poachers', rec: 2, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'scout', name: 'Poacher' }, { primary: 'scout', name: 'Snare Setter' }, { primary: 'rogue', name: 'Skinner' }],
      reward: { xp: 70, gold: 50 } },
    hollow_deep: { name: 'Hollow Deep', map: 'hollow_deep', rec: 3, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'warrior', name: 'Delve Chief' }, { primary: 'rogue', name: 'Tunnel Rat' }, { primary: 'acolyte', name: 'Delve Witch' }],
      objective: { type: 'leader', leader: 0 },
      reward: { xp: 85, gold: 60, items: { chain_coif: 1 } } },
    thornfield_camp: { name: 'Thornfield Raider Camp', map: 'thornfield_camp', rec: 4, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'squire', name: 'Raider' }, { primary: 'archer', name: 'Raider Bowman' }, { primary: 'rogue', name: 'Raider Knife' }],
      objective: { type: 'reach', zone: 'enemy_camp', limit: 9, label: 'Storm the camp' },
      reward: { xp: 100, gold: 70 } },
    river_watch: { name: 'River Watch Standoff', map: 'river_watch', rec: 4, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'warrior', name: 'Mutiny Sergeant' }, { primary: 'archer', name: 'Watch Bowman' }, { primary: 'squire', name: 'Mutineer' }],
      objective: { type: 'survive', turns: 4 },
      reward: { xp: 105, gold: 60 } },
    mosswood_camp: { name: 'Mosswood Camp', map: 'mosswood_camp', rec: 4, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'tracker', name: 'Poacher Captain' }, { primary: 'rogue', name: 'Fence' }, { primary: 'scout', name: 'Lookout' }],
      objective: { type: 'leader', leader: 0 },
      reward: { xp: 110, gold: 80, items: { longbow: 1 } } },
    ashen_obelisk: { name: 'Ashen Obelisk', map: 'ashen_obelisk', rec: 8, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'wizard', name: 'Renegade Adept' }, { primary: 'cleric', name: 'Fallen Warden' }, { primary: 'rogue', name: 'Obelisk Cutthroat' }],
      objective: { type: 'leader', leader: 0 },
      reward: { xp: 160, gold: 110, items: { staff_arcane: 1 } } }
  });

  // Road events: a short scene with options, met while travelling (never a repeat of the last one). once: true = can only ever happen once.
  // Option fields: standing, gold (negative = you pay), items, flag, relations, reveal (learn the roads nearby), fight (it becomes a battle).
  Object.assign(C.CHOICES, {
    old_milestone: { text: 'A Syndicate caravan has lost a wheel and jammed the whole junction. Its factor wants it moving before dark.\n\nA Crown tax-man has planted himself in front of the lead wagon. Its seals are "irregular", he says, and he means to impound the lot. Both of them look at you as if you might settle it.',
      options: [
        { id: 'help_factor', label: 'Help the factor get it moving', hint: 'The Syndicate pays and remembers. The tax-man will report you.', standing: { syndicate: 40, crown: -20 }, gold: 40 },
        { id: 'help_taxman', label: 'Stand with the tax-man', hint: 'The Crown will note it. The factor writes your name down.', standing: { crown: 40, syndicate: -20 } },
        { id: 'leave', label: 'Walk around them', hint: 'Nobody thanks you. Nobody blames you.' }
      ] },
    whispering_glade: { text: 'Wardens have caught a human surveyor with a chain and a map of their shrine. He is very frightened.\n\n"The Crown only wants to know where not to cut," he says. The Wardens have heard that before, from the men who came back with axes.',
      options: [
        { id: 'vouch', label: 'Vouch for him', hint: 'The Crown will be grateful. The Wardens will not forget it.', standing: { crown: 30, canopy: -30 } },
        { id: 'hand_over', label: 'Let the Wardens have him', hint: 'The Canopy approves. The Crown loses a man and blames you.', standing: { canopy: 40, crown: -20 } },
        { id: 'quiet', label: 'Pay for his release, quietly (50 gold)', hint: 'Nobody is pleased, and nobody is angry.', gold: -50, standing: { canopy: 10, crown: 10 } }
      ] },
    road_hurt_trader: { road: true, text: 'A merchant sits against a broken wheel with his goods scattered across the road. There is blood on his sleeve. His hired guards ran at the first arrow and took the horse.\n\n"The Syndicate will make it good," he says faintly. "Probably."',
      options: [
        { id: 'help', label: 'Bind him up and mend the wheel (30 gold of supplies)', hint: 'Costs you supplies. Syndicate traders hear of kindness.', gold: -30, standing: { syndicate: 15 } },
        { id: 'rob', label: 'Go through the cart while he watches', hint: 'Easy coin. The Syndicate looks after its own.', gold: 45, standing: { syndicate: -20 } },
        { id: 'leave', label: 'Walk on' }
      ] },
    road_toll: { road: true, regions: ['crownlands', 'free_marches', 'iceflow'], text: 'A lone Crown tax-collector has strung a rope across the road and set a stool beside it. He has a ledger, a seal and a very tired horse.\n\n"Road toll," he says. "It keeps the bridges up. Some of them."',
      options: [
        { id: 'pay', label: 'Pay the toll (40 gold)', hint: 'The Crown counts it in your favour.', gold: -40, standing: { crown: 10 } },
        { id: 'argue', label: 'Argue that the toll is not lawful here', hint: 'He lets you through, and writes your name down.', standing: { crown: -5 } },
        { id: 'fight', label: 'Cut the rope and see who follows', hint: 'A fight, and the Crown hears of it.', standing: { crown: -15 }, fight: true }
      ] },
    road_pilgrim: { road: true, regions: ['voldun', 'crownlands'], text: 'A Synod pilgrim sits on a milestone with an empty water-skin and a blistered foot. She lost the road two days ago and has been praying about it since.\n\n"I would take an escort to the next village," she says, "or a direction, or a miracle. Whichever you have."',
      options: [
        { id: 'escort', label: 'Walk her to the village', hint: 'A day out of your way. The Synod hears of it.', standing: { synod: 25 } },
        { id: 'water', label: 'Give her water and point the way (10 gold)', hint: 'A small kindness, quickly done.', gold: -10, standing: { synod: 10 } },
        { id: 'leave', label: 'Wish her luck and go on', hint: 'She will be all right. Probably.' }
      ] },
    road_hunter: { road: true, regions: ['elven_realms'], text: 'A Warden hunter is caught in a poacher\'s snare, bleeding from the leg. She has cut herself half free.\n\n"Human snares, on our side of the stones," she says through her teeth. "Someone has to tell the watch."',
      options: [
        { id: 'help', label: 'Bind the wound and carry her word', hint: 'The Wardens will hear you helped.', standing: { canopy: 25 } },
        { id: 'pay', label: 'Help her, for a price (66 gold)', hint: 'She pays, and remembers that you asked.', gold: 30, standing: { canopy: -10 } },
        { id: 'leave', label: 'Leave her to it', hint: 'Not your quarrel. Not yet.' }
      ] },
    road_prospector: { road: true, regions: ['dwarven_holds', 'iceflow'], text: 'A prospector pushes a cart of odd blue ore that glows faintly under its tarp. He keeps looking over his shoulder.\n\n"A share if you see me to market," he says. "The Guild wants it. The clans say it should stay in the mountain."',
      options: [
        { id: 'guard', label: 'Guard him to market', hint: 'Coin for you. The clans like it kept honest.', gold: 40, standing: { ironbound: 10 } },
        { id: 'buy', label: 'Buy a sample for the Guild (25 gold)', hint: 'The Anvil Guild pays attention to people who bring it samples.', gold: -25, standing: { anvil: 10 } },
        { id: 'leave', label: 'Decline', hint: 'His trouble stays his.' }
      ] },
    road_rumour: { road: true, text: 'A peddler at a roadside fire is roasting something that might have been a rabbit. He says he knows every path within three days of here.\n\n"Every path," he says. "For a price. For nothing, I know one."',
      options: [
        { id: 'buy', label: 'Pay for the paths (30 gold)', hint: 'Several places go on your map.', gold: -30, reveal: true },
        { id: 'listen', label: 'Sit and listen for free', hint: 'He lets one thing slip. Only one.', revealNear: 1 },
        { id: 'leave', label: 'No thanks' }
      ] },
    road_deserters: { road: true, text: 'Five armed men step out of the trees and spread across the road. Their coats used to be uniforms.\n\n"Safe passage," their leader says, "for a small fee. It is a dangerous road. We should know."',
      options: [
        { id: 'pay', label: 'Pay them (50 gold)', hint: 'It costs you, and nobody gets hurt.', gold: -50 },
        { id: 'fight', label: 'Refuse', hint: 'A fight.', fight: true },
        { id: 'intimidate', label: 'Stare them down (needs a full party of three)', hint: 'With three of you, they may think better of it.', stare: true }
      ] },
    road_shrine: { road: true, once: true, text: 'A roadside shrine has gone to moss. Nobody has tended it in years, but people still leave coins, and the bowl is full.\n\nA crow on the roof watches you look at it.',
      options: [
        { id: 'take', label: 'Take the coins', hint: 'Easy coin. The pious notice that kind of thing.', gold: 35, standing: { synod: -10, canopy: -10 } },
        { id: 'tend', label: 'Sweep it clean and leave a coin (10 gold)', hint: 'The Synod and the Wardens both like a shrine kept.', gold: -10, standing: { synod: 10, canopy: 10 } },
        { id: 'leave', label: 'Leave it be' }
      ] }
  });

  // Enemy parties met on the road. Level is set by the party; minLv/maxLv pick what fits, regions: null = anywhere.
  C.FOE_SETS = [
    { id: 'bandits', name: 'Road bandits', faction: 'outlaws', minLv: 1, maxLv: 7, regions: null,
      enemies: [{ primary: 'rogue', name: 'Highwayman' }, { primary: 'scout', name: 'Bandit Archer' }, { primary: 'squire', name: 'Cutthroat' }] },
    { id: 'deserters', name: 'Deserters', faction: 'outlaws', minLv: 1, maxLv: 8, regions: ['crownlands', 'free_marches', 'river_cities', 'iceflow'],
      enemies: [{ primary: 'squire', name: 'Deserter' }, { primary: 'squire', name: 'Deserter' }, { primary: 'scout', name: 'Deserter Bowman' }] },
    { id: 'hedge', name: 'Hedge mages', faction: 'outlaws', minLv: 2, maxLv: 8, regions: null,
      enemies: [{ primary: 'apprentice', name: 'Hedge Mage' }, { primary: 'apprentice', name: 'Hedge Mage' }, { primary: 'acolyte', name: 'Hedge Priest' }] },
    { id: 'poachers', name: 'Poachers', faction: 'outlaws', minLv: 1, maxLv: 8, regions: ['elven_realms', 'free_marches', 'river_cities'],
      enemies: [{ primary: 'scout', name: 'Poacher' }, { primary: 'scout', name: 'Poacher' }, { primary: 'rogue', name: 'Skinner' }] },
    { id: 'scavengers', name: 'Delve scavengers', faction: 'outlaws', minLv: 1, maxLv: 8, regions: ['dwarven_holds', 'iceflow'],
      enemies: [{ primary: 'squire', name: 'Scavenger' }, { primary: 'scout', name: 'Scavenger Slinger' }, { primary: 'apprentice', name: 'Tinker' }] },
    { id: 'smugglers', name: 'Smugglers', faction: 'outlaws', minLv: 3, maxLv: 10, regions: ['river_cities', 'elven_realms'],
      enemies: [{ primary: 'rogue', name: 'Smuggler' }, { primary: 'archer', name: 'Dock Sniper' }, { primary: 'shaman', name: 'Fence' }] },
    { id: 'brigands', name: 'Brigand band', faction: 'outlaws', minLv: 5, maxLv: 50, regions: null,
      enemies: [{ primary: 'warrior', name: 'Brigand Chief' }, { primary: 'archer', name: 'Brigand Bowman' }, { primary: 'rogue', name: 'Brigand Knife' }] },
    { id: 'cultists', name: 'Cultists', faction: 'outlaws', minLv: 4, maxLv: 50, regions: ['voldun', 'crownlands'],
      enemies: [{ primary: 'wizard', name: 'Cult Adept' }, { primary: 'cleric', name: 'Cult Preacher' }, { primary: 'acolyte', name: 'Cult Initiate' }] },
    { id: 'mercs', name: 'Sellsword company', faction: 'outlaws', minLv: 7, maxLv: 50, regions: null,
      enemies: [{ primary: 'bulwark', name: 'Sellsword Shield' }, { primary: 'marksman', name: 'Sellsword Gun' }, { primary: 'warrior', name: 'Sellsword Captain' }] }
  ];

  // Monsters (non-humanoid). faction 'wild'; zones = the wild places where they den (picked far more often there); anywhere else they are rare.
  // `lore` ties a set to the bestiary (C.BEASTS below). Humans' attitudes to them (hunt, tame, worship) are in C.MONSTER_FACTIONS.
  Object.assign(C, { MONSTER_SETS: [
    { id: 'm_wolves', name: 'Dire wolf pack', faction: 'wild', monster: true, minLv: 1, maxLv: 7, regions: null, zones: ['elk_meadow', 'dewfall_glade', 'greycrown_peak', 'mist_trail', 'reed_marsh', 'elderwood', 'lowmeadows', 'greatwood', 'brazier_peak', 'giants_tooth', 'frostmarch', 'golden_reach', 'ashfall_reach', 'obsidian_terraces', 'muster_field', 'hollow_fields', 'hungry_mile', 'long_stair', 'molten_run', 'gallows_hill', 'last_cairn', 'warbanner_hill', 'cooling_fields', 'ash_stair', 'signal_tower', 'beacon_hill', 'snowmelt_tarn', 'glass_hollow'],
      enemies: [{ primary: 'dire_wolf', name: 'Dire Wolf' }, { primary: 'dire_wolf', name: 'Dire Wolf' }, { primary: 'dire_wolf', name: 'Pack Leader' }] },
    { id: 'm_bear', name: 'Cave bear', faction: 'wild', monster: true, minLv: 3, maxLv: 10, regions: null, zones: ['dewfall_glade', 'snowmelt_tarn', 'greycrown_peak', 'elk_meadow', 'elderwood', 'lowmeadows', 'greatwood', 'giants_tooth', 'frostmarch', 'golden_reach'],
      enemies: [{ primary: 'cave_bear', name: 'Cave Bear' }, { primary: 'dire_wolf', name: 'Hungry Wolf' }] },
    { id: 'm_spiders', name: 'Webspinners', faction: 'wild', monster: true, minLv: 2, maxLv: 9, regions: null, zones: ['glass_hollow', 'mist_trail', 'leech_ford', 'elderwood', 'greatwood', 'mirefen', 'saltmere', 'fogwater', 'quicklime_pits', 'rotwood', 'the_sump', 'bone_bridge', 'pyre_field', 'vent_of_the_dead', 'bargemans_cairn', 'ember_gallery', 'sulphur_springs'],
      enemies: [{ primary: 'giant_spider', name: 'Giant Spider' }, { primary: 'giant_spider', name: 'Giant Spider' }] },
    { id: 'm_ghouls', name: 'Ghoul pack', faction: 'wild', monster: true, minLv: 3, maxLv: 11, regions: null, zones: ['gallows_hill', 'bone_bridge', 'last_cairn', 'warbanner_hill', 'muster_field', 'hollow_fields', 'hungry_mile', 'quicklime_pits', 'the_sump', 'pyre_field', 'bargemans_cairn'],
      enemies: [{ primary: 'ghoul', name: 'Ghoul' }, { primary: 'ghoul', name: 'Ghoul' }, { primary: 'bone_archer', name: 'Grave Archer' }] },
    { id: 'm_restless', name: 'Restless dead', faction: 'wild', monster: true, minLv: 5, maxLv: 16, regions: null, zones: ['last_cairn', 'pyre_field', 'vent_of_the_dead', 'bone_bridge', 'bargemans_cairn', 'lowmeadows', 'saltmere', 'fogwater', 'muster_field', 'hollow_fields', 'hungry_mile', 'quicklime_pits', 'rotwood', 'gallows_hill', 'warbanner_hill', 'leech_ford', 'mist_trail'],
      enemies: [{ primary: 'banshee', name: 'Banshee' }, { primary: 'bone_archer', name: 'Barrow Archer' }, { primary: 'ghoul', name: 'Barrow Ghoul' }] },
    { id: 'm_embers', name: 'Embers loose', faction: 'wild', monster: true, minLv: 4, maxLv: 14, regions: null, zones: ['ember_gallery', 'vent_of_the_dead', 'cooling_fields', 'sulphur_springs', 'ash_stair', 'ashfall_reach', 'molten_run'],
      enemies: [{ primary: 'fire_elemental', name: 'Ember Elemental' }, { primary: 'fire_elemental', name: 'Ember Elemental' }] },
    { id: 'm_storm', name: 'Storm-spirits', faction: 'wild', monster: true, minLv: 5, maxLv: 14, regions: null, zones: ['signal_tower', 'beacon_hill', 'greycrown_peak', 'brazier_peak', 'giants_tooth', 'frostmarch', 'long_stair'],
      enemies: [{ primary: 'storm_elemental', name: 'Storm Elemental' }, { primary: 'storm_elemental', name: 'Storm Elemental' }] },
    { id: 'm_golem', name: 'Waking guardian', faction: 'wild', monster: true, minLv: 6, maxLv: 50, regions: null, zones: ['ember_gallery', 'signal_tower', 'ash_stair', 'warbanner_hill', 'brazier_peak', 'giants_tooth', 'obsidian_terraces', 'long_stair', 'beacon_hill', 'elk_meadow'],
      enemies: [{ primary: 'stone_golem', name: 'Stone Guardian' }] },
    { id: 'm_drake', name: 'Drake hunting', faction: 'wild', monster: true, minLv: 8, maxLv: 50, regions: null, zones: ['ash_stair', 'vent_of_the_dead', 'cooling_fields', 'greycrown_peak', 'reed_marsh', 'brazier_peak', 'frostmarch', 'ashfall_reach', 'obsidian_terraces', 'molten_run', 'last_cairn', 'sulphur_springs', 'snowmelt_tarn'],
      enemies: [{ primary: 'drake_whelp', name: 'Ash Drake' }, { primary: 'drake_whelp', name: 'Ash Drake' }] },
    { id: 'm_basilisk', name: 'Basilisk', faction: 'wild', monster: true, minLv: 6, maxLv: 50, regions: null, zones: ['sulphur_springs', 'glass_hollow', 'leech_ford', 'reed_marsh', 'mirefen', 'obsidian_terraces', 'saltmere', 'cooling_fields'],
      enemies: [{ primary: 'basilisk', name: 'Basilisk' }, { primary: 'giant_spider', name: 'Stone-fed Spider' }] },
    { id: 'm_horror', name: 'Something from below', faction: 'wild', monster: true, minLv: 8, maxLv: 50, regions: null, zones: ['mist_trail', 'bone_bridge', 'glass_hollow', 'elderwood', 'greatwood', 'mirefen', 'fogwater', 'quicklime_pits', 'rotwood', 'the_sump', 'bargemans_cairn', 'dewfall_glade'],
      enemies: [{ primary: 'maw_horror', name: 'Maw Horror' }, { primary: 'ghoul', name: 'Thrall' }] }
  ] });
  // Patrols: who answers for the roads, by faction. They fight you only if you are Hostile to them.
  C.PATROLS = {
    crown: { name: 'Crown patrol', enemies: [{ primary: 'warrior', name: 'Crown Guard' }, { primary: 'archer', name: 'Crown Bowman' }, { primary: 'squire', name: 'Crown Recruit' }] },
    syndicate: { name: 'Syndicate enforcers', enemies: [{ primary: 'rogue', name: 'Enforcer' }, { primary: 'marksman', name: 'Counting-House Gun' }, { primary: 'rogue', name: 'Enforcer' }] },
    synod: { name: 'Synod watch', enemies: [{ primary: 'wizard', name: 'Synod Adept' }, { primary: 'cleric', name: 'Synod Warden' }, { primary: 'apprentice', name: 'Synod Novice' }] },
    ironbound: { name: 'Ironbound wardens', enemies: [{ primary: 'bulwark', name: 'Hold Shield' }, { primary: 'warrior', name: 'Hold Axe' }, { primary: 'archer', name: 'Hold Crossbow' }] },
    anvil: { name: 'Guild sappers', enemies: [{ primary: 'marksman', name: 'Guild Sapper' }, { primary: 'bulwark', name: 'Guild Shieldhand' }, { primary: 'cleric', name: 'Guild Medic' }] },
    canopy: { name: 'Warden rangers', enemies: [{ primary: 'tracker', name: 'Warden Tracker' }, { primary: 'druid', name: 'Warden Druid' }, { primary: 'scout', name: 'Warden Scout' }] }
  };

  // Where each race starts. Everyone begins neutral (allegiance null) with a different standing, region and opening.
  // Points of interest: one-off scenes that reward curiosity (and sometimes bite back).
  Object.assign(C.CHOICES, {
    hermits_rime: { text: 'An old woman in a hut of furs and ice offers you a seat by her fire. She has lived here forty winters and knows every path the snow leaves open.\n\n"A gift buys a story," she says. "Food buys a friend."',
      options: [{ id: 'pay', label: 'Pay for her paths (25 gold)', hint: 'Places go on your map.', gold: -25, reveal: true }, { id: 'share', label: 'Share your rations with her', hint: 'The Wardens hear of the kindness.', standing: { canopy: 15 } }, { id: 'leave', label: 'Move on' }] },
    moonwell: { text: 'The moonwell is perfectly still and full of silver light, even at noon. Coins glint on the bottom, some of them older than the realm.\n\nThe Wardens say every coin is a promise someone made here.',
      options: [{ id: 'offer', label: 'Make an offering (30 gold)', hint: 'The Canopy honours it.', gold: -30, standing: { canopy: 25 } }, { id: 'take', label: 'Fish out the coins', hint: 'Coin for you. The Wardens call it theft from the dead.', gold: 30, standing: { canopy: -20 } }, { id: 'leave', label: 'Leave it be' }] },
    highspire_rest: { text: 'You climb to the cairn-shrine at the top of the spire. From here you can see half the forest, and the smoke of every village in it.\n\nTravellers add a stone for the ones who did not make it home.',
      options: [{ id: 'look', label: 'Study the land below', hint: 'Nearby places go on your map.', reveal: true }, { id: 'stone', label: 'Add a stone for someone', hint: 'The Wardens notice the old courtesy.', standing: { canopy: 10 } }] },
    tidemother_shrine: { text: 'Shell steps lead down into green water. Fishermen of every people leave something here before a voyage: a coin, a hook, a lock of hair.\n\nThe old offerings lie under the water, out of reach of anyone sensible.',
      options: [{ id: 'offer', label: 'Offer a coin before your road (15 gold)', hint: 'The Wardens and the port\'s traders both approve.', gold: -15, standing: { canopy: 10, syndicate: 10 } }, { id: 'dive', label: 'Dive for the old offerings', hint: 'Coin for you. The Wardens will not like it.', gold: 35, standing: { canopy: -15 } }, { id: 'leave', label: 'Leave' }] },
    carrow_tower: { text: 'Someone has been digging in the cellar of the ruined tower, and left in a hurry. A crate of Crown tax-stamps lies open beside the hole, enough to forge a year of tolls.\n\nWhoever it was will be back for them.',
      options: [{ id: 'loot', label: 'Take what they left', hint: 'Coin for you. The Crown would call it forgery.', gold: 45, standing: { crown: -15 } }, { id: 'report', label: 'Carry the stamps to the Crown', hint: 'The Crown will be grateful, and curious.', standing: { crown: 25 } }, { id: 'leave', label: 'Walk on' }] },
    widows_barrow: { text: 'Rain has broken open the old mound, and grave goods show through the turf: a torque, a cup, a sword gone green.\n\nThe villagers say the widow buried here still sits up at night, waiting for someone who never came back from the war.',
      options: [{ id: 'dig', label: 'Dig out the grave goods', hint: 'Good coin. The Crown hangs grave-robbers, when it catches them.', gold: 60, standing: { crown: -10 } }, { id: 'rest', label: 'Close the mound and say a word for her', hint: 'The Crown likes its old graves kept.', standing: { crown: 10 } }] },
    mooncircle: { text: 'The standing stones are cold even at noon. Inside them, something has pressed a perfect ring of bare earth into the grass, as if a great weight sat there overnight.\n\nNothing grows in the ring. Nothing is sleeping in it now, either.',
      options: [{ id: 'rest', label: 'Rest inside the ring', hint: 'The Wardens say the stones remember who trusts them.', standing: { canopy: 10 } }, { id: 'map', label: 'Study the carvings', hint: 'Old paths go on your map.', reveal: true }, { id: 'leave', label: 'Leave' }] },
    sentinel_ring: { text: 'Seven stones in a ring, each carved with a single open eye. The carvings are older than the forest.\n\nYou are quite sure the stones are watching back.',
      options: [{ id: 'touch', label: 'Touch the stones', hint: 'Something shows you the land around.', reveal: true }, { id: 'leave', label: 'Leave without touching them' }] },
    outlaws_rest: { text: 'A hollow oak, big enough to stable horses, with a smoke-hole and fresh tracks all round it. A scrap of faded red cloth is nailed over the entrance.\n\nSomebody is watching you from the dark inside. Several somebodies.',
      options: [{ id: 'bribe', label: 'Leave a gift at the door (40 gold)', hint: 'Whoever lives here may show you their roads.', gold: -40, reveal: true }, { id: 'raid', label: 'Raid the camp', hint: 'A fight with whoever is inside.', fight: true }, { id: 'leave', label: 'Back away slowly' }] },
    glasswood_spires: { text: 'The pale trunks ring like glass bells in the wind. Travellers come to hear them and drop coins without noticing, and the roots are full of them.',
      options: [{ id: 'gather', label: 'Gather the dropped coins', hint: 'Some coin.', gold: 35 }, { id: 'listen', label: 'Stand and listen to the trees', hint: 'The Wardens say the spires sing for those who stop.', standing: { canopy: 10 } }] },
    deeproot_mines: { text: 'A cave-in has blocked the lower shaft. The foreman is a clansman with a cut over one eye.\n\n"I need strong backs to dig," he says, "or sharp eyes to tell the Guild what this will cost them. The Guild pays better. The clans remember longer."',
      options: [{ id: 'dig', label: 'Help the clansmen dig', hint: 'A little coin. The Ironbound remember.', gold: 25, standing: { ironbound: 15 } }, { id: 'survey', label: 'Survey the damage for the Guild', hint: 'Better coin. The clans will call it counting the dead.', gold: 40, standing: { anvil: 15, ironbound: -10 } }, { id: 'leave', label: 'Leave them to it' }] },
    runefall: { text: 'Scribes hang on ropes down the cliff face, copying runes cut there before the holds were built. A young one swings over to you.\n\n"I can read you the oldest lines," she says. "For a fee. They are mostly directions."',
      options: [{ id: 'read', label: 'Pay her to read them (30 gold)', hint: 'Old paths go on your map.', gold: -30, reveal: true }, { id: 'help', label: 'Help hold the ropes', hint: 'The clans notice who does the dull work.', standing: { ironbound: 15 } }, { id: 'leave', label: 'Move on' }] },
    wolfmothers_den: { text: 'Pup bones lie scattered at the mouth of the den, and fresh tracks lead inside, big ones.\n\nA low growl rolls out of the dark. It is not a warning. It is a question.',
      options: [{ id: 'enter', label: 'Go in', hint: 'A fight.', fight: true }, { id: 'meat', label: 'Leave meat at the entrance (15 gold)', hint: 'The wolves let you pass.', gold: -15 }, { id: 'leave', label: 'Walk away slowly' }] },
    whitestone_abbey: { text: 'Whitestone Abbey is a Hearthwatch house, all bread-smell and old blankets. But the Synod keeps a scriptorium in the east wing, and its clerk-brother greets you by name before you have given it.\n\n"We keep copies of everything," he says. "Including, it seems, you."',
      options: [{ id: 'donate', label: 'Donate to the scriptorium (40 gold)', hint: 'The Synod remembers its friends.', gold: -40, standing: { synod: 30 } }, { id: 'ask', label: 'Ask what they have written about the roads', hint: 'Some places go on your map. The Synod does not like being asked.', standing: { synod: -5 }, reveal: true }, { id: 'leave', label: 'Decline politely' }] },
    drowned_chapel: { text: 'The chapel is half sunk in the marsh. The Hearthwatch keep a lamp lit in the dry half, for anyone lost on the causeway. The bell still hangs in the drowned tower.\n\nSomething has been dragging marsh gas up out of the crypt, and the lamp-keeper will not go down there any more.',
      options: [{ id: 'salvage', label: 'Strip the bell fittings', hint: 'Good brass. The Hearthwatch will not thank you.', gold: 55 }, { id: 'crypt', label: 'Go down into the crypt', hint: 'A fight in the dark.', fight: true }, { id: 'leave', label: 'Leave it' }] },
    reliquary_hill: { text: 'Tombs are cut into the hillside, each with a saint\'s name over the door and a queue of pilgrims in front of it. The doors are locked, but the locks are older than the Synod.',
      options: [{ id: 'pray', label: 'Pray with the pilgrims', hint: 'The Synod sees who kneels.', standing: { synod: 20 } }, { id: 'steal', label: 'Pick a lock when no one is looking', hint: 'Saints are buried with gold. The Synod would never forgive it.', gold: 70, standing: { synod: -40 } }, { id: 'leave', label: 'Leave' }] },
    vent_hollow: { text: 'Steam hisses from a crack in the earth. The yellow rock around it glitters with crystal, and a little further in there are bones, picked clean.',
      options: [{ id: 'mine', label: 'Scrape off the crystals', hint: 'Some coin. You do not look at the bones.', gold: 45 }, { id: 'probe', label: 'Climb down to see what ate them', hint: 'A fight.', fight: true }, { id: 'leave', label: 'Keep well clear' }] },
    sinkhole_shrine: { text: 'A little shrine sits on the rim of a sinkhole. Pilgrims drop offerings in. Nothing ever comes back out.\n\nBut if you lean over and listen, something down there is moving.',
      options: [{ id: 'offer', label: 'Drop in a coin (15 gold)', hint: 'The Synod approves of offerings.', gold: -15, standing: { synod: 10 } }, { id: 'rope', label: 'Lower a rope and fish for offerings', hint: 'Coin, if the something lets you.', gold: 40 }, { id: 'leave', label: 'Leave' }] }
  });

  C.STARTS = {
    human: { location: 'kingsway_cross', crossroads: true, discovered: ['kingsway_cross'],
      standing: { crown: 0, syndicate: 0, synod: 0 }, recruits: [{ primary: 'squire' }, { primary: 'scout' }, { primary: 'acolyte' }],
      opening: 'Kingsway Cross: three roads, one well, and a toll-clerk counting your boots.\n\nThe old king has been dead for years and nobody sits his throne. The lords call the wait "the Interval" and change the subject. In the meantime three powers hold the realm together, each in its own way: the Crown with soldiers and law, the Syndicate with coin and debt, the Synod with prayer and its long memory. Out at the edges, the Broken Banner rides and the Hearthwatch keeps its doors open.\n\nYou have a sword, two companions and no master. Every one of them would like to be your master. Walk the roads, listen, and choose when you are ready.' },
    dwarf: { location: 'deepdelve', discovered: ['deepdelve', 'ironforge', 'mine_collapse', 'koestielve'],
      standing: { ironbound: 300, anvil: -50, crown: 100, syndicate: -100 }, recruits: [{ primary: 'squire' }, { primary: 'acolyte' }, { primary: 'scout' }],
      opening: 'The holds are quiet and the Guild is loud.\n\nA gallery has collapsed under Deepdelve with miners still inside it. The Ironbound clans want it sealed as a grave, the Anvil Guild wants the ore behind it, and both are watching to see which way you step.' },
    wood_elf: { location: 'sylvan_watch', discovered: ['sylvan_watch', 'felled_grove', 'heartwood_trail'],
      standing: { canopy: 300, crown: -300, syndicate: -100 }, recruits: [{ primary: 'scout' }, { primary: 'scout' }, { primary: 'apprentice' }],
      opening: 'Axes are ringing in the old forest.\n\nHuman loggers have come past the marker stones. The Wardens of the Canopy want them gone, by whatever means it takes. To the south, the Cartel’s harbours in the fens offer allies who ask no questions, and trade that never quite says what it carries.' }
  };

  // Time-driven world events. They fire when the day passes `day` (once). Telegraphed first, then they land.
  // ---- scenes and fights for the opening jobs (only open while their job is active) ----
  C.ENCOUNTERS.tithe_raiders = { name: 'The Tithe Barn', map: 'tithe_raiders', rec: 2, enemyFaction: 'outlaws', once: true, job: 'toll_road', winFlag: 'job_toll_won',
    enemies: [{ primary: 'squire', name: 'Deserter' }, { primary: 'scout', name: 'Barn Archer' }, { primary: 'squire', name: 'Deserter' }], reward: { xp: 60, gold: 30 } };
  C.NODES.tithe_barn.encounter = 'tithe_raiders';
  Object.assign(C.CHOICES, {
    pennant_debt: { job: 'pennant_debt', text: 'The farmer meets you at the gate with his hat in his hands. His name is Ebb Thatcher. He borrowed for seed in the spring, the rain never came, and the Syndicate wants its 95 gold.\n\n"Take the grain and we do not eat this winter," he says. "Take the pledge and they own the farm by spring. I know how it works. I signed it."\n\nHis children are watching from the doorway.',
      options: [
        { id: 'collect', label: 'Collect it: the grain now, and a pledge on the farm', hint: 'The Syndicate will be very pleased. The family will not eat well.', standing: { syndicate: 40, crown: -10 }, gold: 40, flag: 'debt_collected', jobFlag: 'job_debt_settled' },
        { id: 'pay', label: 'Pay the 95 gold yourself', hint: 'The debt is settled, the factor is mildly pleased, and you are poorer.', standing: { syndicate: 15 }, gold: -95, flag: 'debt_paid', jobFlag: 'job_debt_settled' },
        { id: 'forgive', label: 'Tell the factor it cannot be collected', hint: 'The family keeps its grain. The Syndicate does not like being told no.', standing: { syndicate: -25 }, flag: 'debt_forgiven', jobFlag: 'job_debt_settled' }
      ] },
    sealed_letter: { job: 'sealed_letter', text: 'A Synod clerk at Orchard Row holds out an ink-stained hand for the pilgrim\'s letter. He does not look up from his ledger.\n\nYou notice the seal: warm wax, a little crooked, as if somebody opened it and sealed it again in a hurry. The pilgrim told you not to be curious. She did not say why.',
      options: [
        { id: 'deliver', label: 'Hand it over unopened', hint: 'The Synod values people who do as they are asked.', standing: { synod: 40 }, flag: 'letter_delivered', jobFlag: 'job_letter_done' },
        { id: 'read', label: 'Read it first, then hand it over', hint: 'You will know what it says. The clerk may notice the seal.', standing: { synod: 10 }, flag: 'letter_read', jobFlag: 'job_letter_done' },
        { id: 'burn', label: 'Burn it in the clerk\'s own candle', hint: 'Whatever it said, nobody reads it now. The Synod will be furious.', standing: { synod: -30 }, flag: 'letter_burned', jobFlag: 'job_letter_done' }
      ] },
    hedge_mage: { job: 'hedge_mage', text: 'The healer at Pale Vigil is a plain woman called Hilde, with ink on her fingers and a kettle always on. She has cured half the village of the winter cough with herbs and something else, something warm that comes out of her hands.\n\nShe has no licence and cannot cast a ward to save herself. She knows exactly why the chantry sent you.\n\n"I could run," she says. "I am tired of running. Do what you came to do."',
      options: [
        { id: 'hand', label: 'Tell the chantry where she is', hint: 'The Synod pays well and trusts you more. She will be registered, or worse.', standing: { synod: 50 }, gold: 60, flag: 'mage_handed', jobFlag: 'job_mage_done' },
        { id: 'hide', label: 'Tell them she was gone when you arrived', hint: 'She is safe. If the Synod learns the truth, so are you not.', standing: { synod: -35 }, flag: 'mage_hidden', jobFlag: 'job_mage_done' },
        { id: 'warn', label: 'Warn her first, then report the truth', hint: 'She gets a head start. The Synod gets its report.', standing: { synod: 10 }, flag: 'mage_warned', jobFlag: 'job_mage_done' }
      ] }
  });
  C.NODES.pennant_green.choice = 'pennant_debt'; C.NODES.orchard_row.choice = 'sealed_letter'; C.NODES.pale_vigil.choice = 'hedge_mage';

  C.EVENTS = [
    { id: 'marches_warning', day: 12, text: 'Scouts report raiders massing near the Free Marches. An attack is expected within two weeks.',
      effect: st => { st.world.flags.marches_warned = true; } },
    { id: 'marches_attack', day: 24, text: 'Raiders have overrun the Free Marches.',
      effect: st => { if (!st.world.flags.marches_defended) { const n = nodeState(st, 'free_marches'); n.owner = 'outlaws'; n.besieged = true; st.world.flags.marches_lost = true; } } },
    { id: 'human_split', day: 40, text: 'The Syndicate has bought up a great lord\'s debts and called them in. The lords call it betrayal; the Syndicate calls it bookkeeping. Either way, the Crown and the Syndicate are now openly at odds, and anyone who serves both will feel it.',
      effect: st => { S().shiftRelation(st, 'crown', 'syndicate', -0.3, { both: true }); st.world.flags.crown_syndicate_feud = true; } },
    { id: 'synod_crackdown', day: 56, text: 'The Synod has declared the Syndicate\'s hired mages heretics and sent inquisitors to the River Cities. The Syndicate is furious. The Crown, which owes the Syndicate a great deal, is quietly pleased.',
      effect: st => { S().shiftRelation(st, 'synod', 'syndicate', -0.2, { both: true }); S().shiftRelation(st, 'synod', 'crown', 0.15, { both: true }); } }
  ];

  // ---- Zones: the wild places where random trouble lives. Ordinary roads are quiet; a zone rolls on arrival. ----
  const ZONES = { glass_hollow: 2, dewfall_glade: 1, gallows_hill: 3, ember_gallery: 2, snowmelt_tarn: 2, elk_meadow: 1, last_cairn: 2, beacon_hill: 1, signal_tower: 2, greycrown_peak: 2,
    bargemans_cairn: 2, warbanner_hill: 3, vent_of_the_dead: 3, ash_stair: 3, cooling_fields: 3, pyre_field: 2, sulphur_springs: 2, bone_bridge: 2, mist_trail: 2, leech_ford: 2 };
  Object.entries(ZONES).forEach(([id, d]) => { const n = C.NODES[id]; if (!n) throw new Error('ZONES: unknown ' + id); n.type = 'zone'; n.danger = d; });

  // ---- Dungeons: a node you enter for a chain of fights. Some refill after a while (a den, a barrow), some clear for good (a story ruin).
  // Leaf nodes hanging off one parent place, so they never cut the road network. `hidden` ones are not on the map until revealed (rumours, quests, or visiting the parent at the right level).
  // Every dungeon floor has its own map (dgm_<dungeon>_<floor>, built by tools/dungeon_maps.py in data/maps.js).
  const U = s => { const [primary, name] = s.split(':'); return { primary, name }; };
  const FL = (name, ...u) => ({ name, enemies: u.map(U) });
  const BOSS = (name, ...u) => ({ name, enemies: u.map(U), boss: true });
  C.DUNGEONS = {
    rat_run_warren: { name: 'Rat Run Warren', parent: 'rat_run', pos: [0.9466, 0.727], tier: 1, rec: 3, respawn: 7, hidden: false,
      desc: 'A smugglers\' warren under the reeds. The Cartel keeps digging new tunnels.', why: 'The Cartel keeps digging, and the runners keep coming back.',
      first: { gold: 60, items: { chain_coif: 1 } },
      floors: [FL('Tunnel mouth', 'squire:Rat Runner', 'scout:Dart Slinger', 'scout:Dart Slinger'), FL('The sorting room', 'rogue:Warren Knife', 'rogue:Warren Knife', 'apprentice:Fuse Boy'), BOSS('The Rat King\'s den', 'warrior:Warren Boss', 'rogue:Warren Knife', 'archer:Crossbow Rat')] },
    old_toll_cellars: { name: 'Old Toll Cellars', parent: 'old_toll', pos: [0.4115, 0.6362], tier: 1, rec: 3, respawn: 8, hidden: false,
      desc: 'Cellars under the ruined toll house, where the last keeper\'s strongbox is said to lie.', why: 'Every gang in the district wants the strongbox, so new ones keep moving in.',
      first: { gold: 80, items: { traveler_boots: 1 } },
      floors: [FL('The stair', 'squire:Toll Thug', 'scout:Rooftop Archer', 'squire:Toll Thug'), FL('The tally room', 'rogue:Cellar Knife', 'shaman:Fence', 'rogue:Cellar Knife'), BOSS('The strongbox vault', 'warrior:Toll Reaver', 'archer:Vault Bowman', 'rogue:Lockpick')] },
    thistledown_well: { name: 'The Old Well', parent: 'thistledown', pos: [0.359, 0.4439], tier: 1, rec: 2, respawn: 7, hidden: true, reveal: { auto: true, minLevel: 1 },
      desc: 'A very old well that goes down much further than a well should.', why: 'Something below keeps breeding, and the charcoal burners keep it at bay.',
      first: { gold: 40, items: { mana_ring: 1 } },
      floors: [FL('Down the shaft', 'scout:Cave Rat', 'scout:Cave Rat', 'squire:Rat Swarm'), FL('The flooded chamber', 'squire:Drowned Rat', 'giant_spider:Pale Spider', 'scout:Cave Rat'), BOSS('The wellhead', 'warrior:Great Rat', 'scout:Cave Rat', 'scout:Cave Rat')] },
    frozen_falls_cave: { name: 'Cave Behind the Falls', parent: 'frozen_falls', pos: [0.766, 0.2468], tier: 2, rec: 5, respawn: 12, hidden: false,
      desc: 'A cave behind a waterfall frozen mid-fall. Something blue moves inside.', why: 'The winter ice thaws and refreezes, and brings more up with it.',
      first: { gold: 140, items: { frost_ward: 1, warding_amulet: 1 } },
      floors: [FL('The ice shelf', 'cave_bear:Frost Bear', 'dire_wolf:Snow Wolf', 'dire_wolf:Snow Wolf'), FL('The blue gallery', 'shaman:Ice Wraith', 'berserker:Frost Troll', 'apprentice:Rime Wisp'), BOSS('The frozen throne', 'wizard:Rime Warden', 'berserker:Frost Troll', 'shaman:Ice Wraith')] },
    drowned_idol_depths: { name: 'Idol\'s Throat', parent: 'drowned_idol', pos: [0.8074, 0.946], tier: 2, rec: 5, respawn: 10, hidden: false,
      desc: 'The fen drains into a hole beneath the statue. Offerings go down. Things come up.', why: 'The fen keeps feeding it, and it keeps answering.',
      first: { gold: 120, items: { sage_pendant: 1 } },
      floors: [FL('The offering pool', 'acolyte:Mire Cultist', 'squire:Drowned Thrall', 'squire:Drowned Thrall'), FL('The silt stair', 'shaman:Bog Seer', 'rogue:Reed Knife', 'acolyte:Mire Cultist'), BOSS('The idol\'s heart', 'shaman:Idol Priest', 'squire:Drowned Thrall', 'necro:Fen Bonecaller')] },
    sunken_cloister_crypt: { name: 'The Singing Crypt', parent: 'sunken_cloister', pos: [0.826, 0.6072], tier: 2, rec: 6, respawn: 14, hidden: true, reveal: { auto: true, minLevel: 4 },
      desc: 'Beneath the slipped cloister, a choir that never finished its last hymn.', why: 'The song calls the restless up again, however often they are put down.',
      first: { gold: 160, items: { warding_amulet: 1 } },
      floors: [FL('The nave', 'necro:Choir Shade', 'acolyte:Penitent Ghost', 'squire:Hollow Monk'), FL('The cantor\'s gallery', 'wizard:Whisper Cantor', 'necro:Choir Shade', 'acolyte:Penitent Ghost'), BOSS('The last hymn', 'cleric:Choirmaster', 'necro:Choir Shade', 'wizard:Whisper Cantor')] },
    silt_wharf_undercroft: { name: 'Silt Wharf Undercroft', parent: 'silt_wharf', pos: [0.5342, 0.5509], tier: 2, rec: 6, respawn: 12, hidden: true, reveal: { auto: true, minLevel: 4 },
      desc: 'A drowned warehouse under the wharf, where cargo is moved that no ledger lists.', why: 'The Syndicate never admits to it, so someone always moves in to take over the trade.',
      first: { gold: 200, items: { swift_charm: 1 } },
      floors: [FL('The loading dock', 'rogue:Dock Knife', 'archer:Dock Sniper', 'squire:Stevedore'), FL('The sunk cellar', 'marksman:Counting-House Gun', 'rogue:Dock Knife', 'shaman:Fence'), BOSS('The sub-ledger', 'warlord:Wharf Master', 'marksman:Counting-House Gun', 'rogue:Dock Knife')] },
    applecourt_cellars: { name: 'Applecourt Cellars', parent: 'applecourt', pos: [0.5703, 0.2588], tier: 2, rec: 6, respawn: null, hidden: true, reveal: { auto: false },
      desc: 'The manor\'s lord has not been seen in months. The cellars go further than the manor does.', why: 'What lived here is put down for good, if you finish it.',
      first: { gold: 150, items: { healer_locket: 1 } },
      floors: [FL('The orchard cellar', 'squire:Hollow Footman', 'scout:Cider-Soaked Ghost', 'acolyte:Chapel Shade'), FL('The wine vault', 'necro:Cellar Whisper', 'squire:Hollow Footman', 'squire:Hollow Footman'), BOSS('The lord\'s chamber', 'necro:The Lord of Applecourt', 'acolyte:Chapel Shade', 'squire:Hollow Footman')] },
    skull_quarry_pits: { name: 'Skull Quarry Pits', parent: 'skull_quarry', pos: [0.6086, 0.827], tier: 3, rec: 9, respawn: 10, hidden: false,
      desc: 'Deep in the quarry the orcs dig for something under the bones. Something digs back.', why: 'The quarry is an old battlefield. There is always more under it.',
      first: { gold: 320, items: { plate_armor: 1 } },
      floors: [FL('The bone terraces', 'berserker:Quarry Brute', 'necro:Bone Caller', 'berserker:Quarry Brute'), FL('The ossuary', 'banshee:Marrow Wail', 'ghoul:Quarry Ghoul', 'ghoul:Quarry Ghoul'), FL('The deep seam', 'siegebreaker:Bone Colossus Spawn', 'necro:Bone Caller', 'shadowknight:Grave Guard'), BOSS('The heart of the quarry', 'siegebreaker:The Bone Colossus', 'necro:Bone Caller', 'wizard:Marrow Mage')] },
    oathstone_crypt: { name: 'The Oathbreakers\' Crypt', parent: 'oathstone', pos: [0.6977, 0.1722], tier: 3, rec: 8, respawn: null, hidden: true, reveal: { auto: false },
      desc: 'Broken oaths are chiselled off the Oathstone. The names are kept below.', why: 'The dead here are bound by their own words. Free them and they stay free.',
      first: { gold: 280, items: { tower_shield: 1 } },
      floors: [FL('The unsworn hall', 'warrior:Oathless Shade', 'bulwark:Hold Shield Shade', 'archer:Bowman Shade'), FL('The chisel chamber', 'berserker:Broken Axe', 'cleric:Last Confessor', 'warrior:Oathless Shade'), FL('The names', 'bulwark:Hold Shield Shade', 'wizard:Rune Shade', 'cleric:Last Confessor'), BOSS('The first oath', 'warlord:The Oathless King', 'bulwark:Hold Shield Shade', 'warrior:Oathless Shade')] },
    kings_barrow_depths: { name: 'The King\'s Barrow', parent: 'kings_barrow', pos: [0.566, 0.3899], tier: 3, rec: 8, respawn: null, hidden: true, reveal: { auto: false },
      desc: 'The old king\'s tomb, sealed, and guarded by nobles who do not say what for.', why: 'It is sealed once and for all, whatever is found.',
      first: { gold: 300, items: { siphon_band: 1 } },
      floors: [FL('The sealed door', 'warrior:Tomb Guard', 'archer:Tomb Archer', 'bulwark:Tomb Shieldwall'), FL('The hall of banners', 'wizard:Barrow Wight', 'ghoul:Grave Ghoul', 'ghoul:Grave Ghoul'), FL('The long gallery', 'shadowknight:Barrow Knight', 'warrior:Tomb Guard', 'archer:Tomb Archer'), BOSS('The old king', 'barrow_king:The Old King', 'shadowknight:Barrow Knight', 'bone_archer:Barrow Archer')] },
    bubbling_vats_undercellar: { name: 'The Vats Undercellar', parent: 'bubbling_vats', pos: [0.9555, 0.821], tier: 3, rec: 9, respawn: 12, faction: 'bilge_rats', hidden: true, reveal: { auto: true, minLevel: 7 },
      desc: 'Where the Cartel keeps the experiments that did not work.', why: 'The Cartel never throws a failed batch away. It sends it downstairs.',
      first: { gold: 340, items: { staff_storm: 1 } },
      floors: [FL('The tanks', 'wizard:Vat Alchemist', 'rogue:Fuse Runner', 'apprentice:Bomb Boy'), FL('The cold store', 'stormcaller:Cell Tender', 'wizard:Vat Alchemist', 'rogue:Fuse Runner'), FL('The sump', 'berserker:Failed Batch', 'berserker:Failed Batch', 'wizard:Vat Alchemist'), BOSS('The master batch', 'stormcaller:The Chief Alchemist', 'berserker:Failed Batch', 'wizard:Vat Alchemist')] },
    bonehall_pit: { name: 'The Bonehall Pit', parent: 'bonehall', pos: [0.3972, 0.793], tier: 4, rec: 12, respawn: 14, hidden: true, reveal: { auto: true, minLevel: 10 },
      desc: 'Under the feast hall of ribs, the Legion\'s champions fight for the right to lead.', why: 'The Legion always has more challengers than it has hall.',
      first: { gold: 600, items: { greatsword: 1, plate_helm: 1 } },
      floors: [FL('The challengers\' gate', 'berserker:Pit Brawler', 'blood_knight:Legion Challenger', 'archer:Spear Thrower'), FL('The blood sand', 'blood_knight:Legion Challenger', 'berserker:Pit Brawler', 'shaman:War Priest'), FL('The champions\' row', 'warlord:Pit Champion', 'blood_knight:Legion Challenger', 'siegebreaker:Wall Breaker'), BOSS('The throne of ribs', 'warlord:The Pit Warlord', 'blood_knight:Legion Challenger', 'siegebreaker:Wall Breaker')] },
    fading_wards_vault: { name: 'The Fading Wards Vault', parent: 'fading_wards', pos: [0.8069, 0.35], tier: 4, rec: 12, respawn: null, hidden: true, reveal: { auto: false },
      desc: 'The rune-pillars are failing, and what they held back is stirring below.', why: 'It was sealed once. It will not be sealed again.',
      first: { gold: 650, items: { staff_arcane: 1, warding_amulet: 1 } },
      floors: [FL('The dark pillars', 'wizard:Ward Husk', 'enchanter:Rune Thief', 'wizard:Ward Husk'), FL('The silent ring', 'storm_elemental:Storm Shade', 'enchanter:Rune Thief', 'storm_elemental:Storm Shade'), FL('The sealed stair', 'stone_golem:Ward Guardian', 'wizard:Ward Husk', 'spellbow:Star Hunter'), BOSS('The first ward', 'wizard:The Ward-Eater', 'shadowmage:Veil Walker', 'enchanter:Rune Thief')] }
  };
  Object.entries(C.DUNGEONS).forEach(([id, d]) => {
    const par = C.NODES[d.parent]; if (!par) throw new Error('DUNGEONS: unknown parent ' + d.parent);
    C.NODES[id] = { name: d.name, region: par.region, type: 'dungeon', pos: (C.MAP_POS[id] || d.pos).slice(), desc: d.desc, dungeon: id, hidden: !!d.hidden, links: {} };
    C.NODES[id].links[d.parent] = 1; par.links[id] = 1; C.EDGES.push([d.parent, id, 1]);
    d.floors.forEach((f, i) => {
      const last = i === d.floors.length - 1, rec = d.rec + (f.boss ? 1 : 0);
      C.ENCOUNTERS['dg_' + id + '_' + (i + 1)] = { name: d.name + ': ' + f.name, map: 'dgm_' + id + '_' + (i + 1), rec, enemyFaction: d.faction || 'wild', enemies: f.enemies.map(e => Object.assign({}, e)),
        objective: f.boss ? { type: 'leader', leader: 0 } : null, once: false, dungeon: id, floor: i + 1, baseReward: { xp: Math.round((30 + 12 * rec) * (f.boss ? 1.8 : 1)), gold: Math.round((10 + 5 * rec) * (f.boss ? 2 : 1)) },
        reward: { xp: 0, gold: 0 } };
    });
  });

  // ---- state helpers ----
  function nodeState(st, id) { return st.world.nodes[id] || (st.world.nodes[id] = {}); }
  C.ownerOf = (st, id) => (st.world.nodes[id] && st.world.nodes[id].owner) || (C.NODES[id] && C.NODES[id].owner) || null;
  C.isDiscovered = (st, id) => !!(st.world.nodes[id] && st.world.nodes[id].discovered);
  C.discover = (st, id) => { const n = C.NODES[id]; if (!n) return; if (n.hidden && !st.world.flags['reveal_' + id]) return; nodeState(st, id).discovered = true; };

  C.startOptions = () => Object.keys(C.STARTS).filter(r => G().races[r] && G().races[r].active).map(r => ({ race: r, name: G().races[r].name, desc: G().races[r].desc, trait: G().races[r].trait, opening: C.STARTS[r].opening, location: C.STARTS[r].location }));

  // Plain-language lines for what a race gives (read from data/races.js, so the creator never drifts from the rules).
  C.traitLines = function (raceId) {
    const R = G().races[raceId]; if (!R) return []; const o = [], m = R.statMods || {};
    if (m.hp) o.push((m.hp > 0 ? '+' : '') + m.hp + ' max HP'); if (m.mv) o.push((m.mv > 0 ? '+' : '') + m.mv + ' move'); if (m.jump) o.push((m.jump > 0 ? '+' : '') + m.jump + ' jump'); if (m.spd) o.push((m.spd > 0 ? '+' : '') + m.spd + ' speed');
    if (R.armor) o.push('+' + R.armor + '% armor'); if (R.rangedReduce) o.push(R.rangedReduce + '% less damage from ranged attacks'); if (R.pushImmune) o.push('Cannot be pushed');
    if (R.jpRate && R.jpRate !== 1) o.push('JP gain ×' + R.jpRate);
    return o;
  };
  // Create a new campaign for a race: recruits named from the race list, standing, location and the discovered nodes of that start.
  C.newGame = function (opts) {
    opts = opts || {}; const race = opts.race, R = G().races[race], T = C.STARTS[race];
    if (!R || !T || !R.active) throw new Error('Race cannot start a game: ' + race);
    const recruits = T.recruits.map((r, i) => Object.assign({ name: R.names[i % R.names.length], race }, r));
    const hc = opts.heroClass && G().classes[opts.heroClass]; // the hero (first recruit) may start as any entry class
    if (hc && G().classes[opts.heroClass].tier === 1 && G().classes[opts.heroClass].selectable !== false) recruits[0].primary = opts.heroClass;
    if (opts.name && String(opts.name).trim()) recruits[0].name = String(opts.name).trim().slice(0, 16);
    const st = S().newGame({ name: opts.name, race, slot: opts.slot, location: T.location, standing: T.standing, recruits, gold: opts.gold });
    T.discovered.forEach(id => C.discover(st, id));
    Object.keys(C.NODES[T.location].links).forEach(id => C.discover(st, id)); // you know the roads out of where you stand
    T.discovered.forEach(id => { const seen = { [T.location]: null }, q = [T.location]; while (q.length) { const x = q.shift(); if (x === id) break; Object.keys(C.NODES[x].links).forEach(y => { if (!(y in seen)) { seen[y] = x; q.push(y); } }); } // you know the way to places you have heard of
      for (let x = id; x && x !== T.location; x = seen[x]) C.discover(st, x); });
    S().markMet(st, C.NODES[T.location].owner); st.world.flags.opening = T.opening; if (race !== 'human') st.world.flags.guide_none = 1;
    return st;
  };

  // ---- guided first week (the 'crossroads week'): a short checklist that lets each power introduce itself and leaves a lead to follow ----
  // Steps can be done in any order. Each finished step shows its 'talk' once, may reveal a route (lead), and the last pays a small purse. The player can skip it.
  C.discoverRoute = function (st, from, to) {
    const seen = { [from]: null }, q = [from];
    while (q.length) { const x = q.shift(); if (x === to) break; Object.keys(C.NODES[x].links).forEach(y => { if (!(y in seen)) { seen[y] = x; q.push(y); } }); }
    for (let x = to; x && x in seen; x = seen[x]) C.discover(st, x);
  };
  const fl = (st, k) => !!st.world.flags[k], vis = (st, id) => !!(st.world.nodes[id] && st.world.nodes[id].visited);
  C.GUIDE = [
    { id: 'gear', title: 'Gear up', hint: 'Kingsway Cross has a shop. Buy anything: a blade, a pair of boots.', done: st => fl(st, 'g_buy'),
      talk: 'The shopkeeper weighs your coin and your companions together. "First time on the crossroads? Then learn this: every road belongs to somebody. Rivermeet, south on the river road, is where the Crown keeps its garrison. Go and see whose roads these are before you get lost on one."' },
    { id: 'crown', title: 'Walk to Rivermeet', hint: 'Open the map and tap Rivermeet. Roads take a day each.', done: st => vis(st, 'rivermeet'), lead: ['crown_keep'],
      talk: 'THE CROWN. Rivermeet flies the royal colours, a little faded. The sergeants here pay for steady swords and remember who held a line. They believe order, even stiff and unfair order, is better than a war over the empty throne.\n\nBut the Crown is brittle. Its lords keep their own grain and their own spears, and in the corner of the garrison tavern a Syndicate factor is buying them one debt at a time. A captain mentions Crown Keep, where the throne waits for somebody. You now know the way there.' },
    { id: 'fight', title: 'Win a fight', hint: 'Zones such as the Golden Reach are where trouble finds travellers. Walk in and see.', done: st => fl(st, 'g_fight'), lead: ['canalgate'],
      talk: 'THE SYNDICATE. The men you beat were debt-collectors, and not very good ones. One carried a ledger slip stamped for Canalgate.\n\nThe Syndicate lends, buys and collects. It paid for bridges when the Crown could not, and it owns half the wells it dug. It says a debt paid is a war nobody fights, and it pays well for anyone useful and quiet. You now know the way to Canalgate.' },
    { id: 'synod', title: 'Walk to Pennant Green', hint: 'A village on the other side of the crossroads. Pilgrims pass through it.', done: st => vis(st, 'pennant_green'), lead: ['orchard_row'],
      talk: 'THE SYNOD. A pilgrim shares her bread with you on the green and asks nothing for it.\n\nThe Synod keeps the chantries and the hospices, hears confessions and writes everything down. It polices magic, because it has seen what wild magic does to a village, and it never forgets what it has been told. The pilgrim points you to Orchard Row, where the clerks are. You now know the way there.' },
    { id: 'factions', title: 'Open the Factions tab', hint: 'Tap Factions at the bottom. It shows where you stand, offers, and who is watching you.', done: st => fl(st, 'g_factions'), purse: 50,
      talk: 'Nobody owns you yet. Your standing with each power moves with what you do, and what you do for one is noticed by the others.\n\nWhen a power has noticed you, someone of theirs will offer you a try-out. Pass it and they will invite you in. You can serve one, serve two and keep one secret, or stay free. The rest of the map is yours to uncover.' }
  ];
  C.guideState = function (st) { const f = st.world.flags; return { off: !!(f.guide_off || f.guide_done), steps: C.GUIDE.map(g => ({ id: g.id, title: g.title, hint: g.hint, done: !!f['gd_' + g.id] })) }; };
  C.guideFlag = (st, k) => { st.world.flags[k] = 1; };
  C.guideSkip = st => { st.world.flags.guide_off = 1; };
  C.guideCheck = function (st) {
    const f = st.world.flags, out = []; if (!f.opening || f.guide_off || f.guide_done || f.guide_none) return out;
    C.GUIDE.forEach(g => { if (f['gd_' + g.id] || !g.done(st)) return; f['gd_' + g.id] = 1;
      (g.lead || []).forEach(id => C.discoverRoute(st, st.world.location, id)); if (g.purse) st.inventory.gold += g.purse;
      ({ crown: 'crown', fight: 'syndicate', synod: 'synod' })[g.id] && S().markMet(st, ({ crown: 'crown', fight: 'syndicate', synod: 'synod' })[g.id]);
      out.push({ id: g.id, title: g.title, talk: g.talk, purse: g.purse || 0, lead: g.lead || [] }); });
    if (C.GUIDE.every(g => f['gd_' + g.id])) f.guide_done = 1;
    return out;
  };

  // ---- jobs: small quests for the starting country. A job is offered at a place, has steps (flags set by scenes and fights, or a visit), and is reported back at the giver. ----
  // Scenes and fights tied to a job are only open while it is active (choice.job / encounter.job); encounter.winFlag is set on a win. Rewards: gold, standing, and rumours (reveal) that put hidden places on the map.
  C.JOBS = {
    toll_road: { name: 'The Tithe Barn Road', giver: 'crown', at: 'rivermeet', after: null,
      offer: 'A Crown sergeant with a broken nose slaps a map on the table. "Deserters. Our own, once. They have taken the Tithe Barn and they are robbing the grain carts on the river road, and every cart they rob is bread somebody in Rivermeet does not eat."\n\n"Clear them out. The Crown does not forget a favour. It does not forget a failure either."',
      steps: [{ text: 'Drive the raiders out of the Tithe Barn', flag: 'job_toll_won' }], done: 'The carts roll again. The sergeant counts out your pay without looking up, then does look up. "Most sellswords take the money and ask what the job was for. You did not ask. I will remember that, for good or ill."',
      reward: { gold: 90, standing: { crown: 60 } } },
    barrow_whispers: { name: 'Lights in the Barrow', giver: 'crown', at: 'crown_keep', after: 'toll_road',
      offer: 'A grey steward in Crown Keep draws you into a window-seat and lowers his voice. Shepherds have seen lights at night in the King\'s Barrow, where the old king lies sealed.\n\n"Nobody is supposed to go in there. Nobody has a key." He pauses. "Go and look. Do not touch anything. Tell me what you see, and tell nobody else."',
      steps: [{ text: 'Visit the King\'s Barrow', visit: 'kings_barrow' }], done: 'The steward listens to every word and goes pale at the part about the door. "Resealed," he repeats. Then, very quietly, he tells you of a way down into the Barrow that the masons used. "The Crown would rather this stayed quiet. So would I. So, I think, would you."',
      reward: { gold: 60, standing: { crown: 40 }, reveal: ['kings_barrow_depths'] } },
    pennant_debt: { name: 'A Debt at Pennant Green', giver: 'syndicate', at: 'rivermeet', after: null,
      offer: 'A Syndicate factor in a good grey coat taps a ledger with one clean fingernail. "Ebb Thatcher, Pennant Green. Ninety-five gold for seed, overdue since the harvest failed. The Syndicate would like it settled."\n\n"How you settle it is your business," she says. "A settled account is a settled account. But I will read what you did, and so will people above me."',
      steps: [{ text: 'Settle the farmer\'s debt at Pennant Green', flag: 'job_debt_settled' }], done: 'The factor reads your account of it and makes a small note beside your name. She does not say what the note is. She never will.',
      reward: { gold: 40, standing: { syndicate: 25 } } },
    cellar_ledger: { name: 'The Applecourt Cellars', giver: 'syndicate', at: 'rivermeet', after: 'pennant_debt',
      offer: 'The factor slides a stained slip across the table. "Smugglers have a cache in the cellars under Applecourt. One of our ledgers went down there with a clerk, and only the clerk came back, without it."\n\n"Go and see that the village is still standing," she says. "That is what I will tell people I asked. What we care about is the ledger."',
      steps: [{ text: 'Visit Applecourt', visit: 'applecourt' }], done: 'The factor hears about the cellars and smiles in a way you do not like. "Then the ledger is still down there. Good." The way into the cellars is now on your map, if you want to go and fetch it.',
      reward: { gold: 70, standing: { syndicate: 40 }, reveal: ['applecourt_cellars'] } },
    sealed_letter: { name: 'A Sealed Letter', giver: 'synod', at: 'pennant_green', after: null,
      offer: 'The pilgrim from the roadside, her foot bound up now, presses a sealed letter into your hands. "For the Synod\'s clerks at Orchard Row. I am too lame to walk it in time, and it must be there in time."\n\n"Do not lose it," she says. Then, more quietly: "And do not be curious. Curiosity is how people end up in letters."',
      steps: [{ text: 'Take the letter to Orchard Row', flag: 'job_letter_done' }], done: 'The pilgrim weighs your face for a long moment when you tell her it is delivered, as if reading what you have not said. Then she thanks you, and means it.',
      reward: { gold: 50, standing: { synod: 20 } } },
    hedge_mage: { name: 'The Hedge-Mage', giver: 'synod', at: 'orchard_row', after: 'sealed_letter',
      offer: 'A clerk at Orchard Row asks for a quiet pair of hands. "A self-taught healer is lodging at Pale Vigil. Unlicensed. Unwatched. Half the village swears by her, which is half the problem."\n\n"Talk to her," he says. "See what she is. The chantry will hear what you tell it, and act on it. Choose your words."',
      steps: [{ text: 'Meet the healer at Pale Vigil', flag: 'job_mage_done' }], done: 'The clerk writes down exactly what you say, word for word, and reads it back to you. "Is that all of it?" You nod. What he does with it now is the Synod\'s business, and the Synod does not forget.',
      reward: { gold: 40, standing: { synod: 15 } } }
  };

  // General side quests: small jobs from ordinary folk. Giver 'general'. Step kinds: flag (set by a fight), visit, tavern (have a drink there after taking the job), clear (a dungeon is cleared).
  C.ENCOUNTERS.gq_poachers = { name: 'Poachers at Ploughman\'s Ford', map: 'hollow_fields', rec: 2, enemyFaction: 'outlaws', once: true, job: 'poachers', winFlag: 'job_poachers_won', enemies: [{ primary: 'scout', name: 'Poacher' }, { primary: 'squire', name: 'Poacher' }, { primary: 'rogue', name: 'Skinner' }], reward: { xp: 60, gold: 25 } };
  C.ENCOUNTERS.gq_smugglers = { name: 'Cask Hollow Smugglers', map: 'vane_smugglers', rec: 3, enemyFaction: 'bilge_rats', once: true, job: 'cask_trouble', winFlag: 'job_cask_won', enemies: [{ primary: 'rogue', name: 'Runner' }, { primary: 'warrior', name: 'Cask Guard' }, { primary: 'archer', name: 'Lookout' }], reward: { xp: 80, gold: 30 } };
  C.ENCOUNTERS.gq_brigands = { name: 'Brigands of Hobb\'s Reach', map: 'gallows_hill', rec: 3, enemyFaction: 'outlaws', once: true, job: 'gallows_brigands', winFlag: 'job_brigands_won', enemies: [{ primary: 'warrior', name: 'Brigand' }, { primary: 'scout', name: 'Brigand Archer' }, { primary: 'acolyte', name: 'Camp Healer' }], reward: { xp: 90, gold: 35 } };
  C.NODES.ploughmans_ford.encounter = 'gq_poachers'; C.NODES.cask_hollow.encounter = 'gq_smugglers'; C.NODES.hobbs_reach.encounter = 'gq_brigands';
  Object.assign(C.JOBS, {
    lost_flock: { name: 'The Lost Flock', giver: 'general', at: 'sheepfold', after: null, offer: 'A shepherd wrings her hat between her hands. "Eleven gone in the night, and the dog came home alone with its tail down. They always head for Hollow Fields when they get out. There is something else out there lately. Could you look?"',
      steps: [{ text: 'Look for the strays at Hollow Fields', visit: 'hollow_fields' }], done: 'The shepherd counts eleven sheep, twice, and one very smug dog. She pays you in coin and wool and will not take no for either.', reward: { gold: 25 } },
    mill_lamps: { name: 'Lamps for the Mill', giver: 'general', at: 'duskwater_mill', after: null, offer: 'The miller\'s lamp oil has run out, and the mill has to grind through the night or the village\'s flour spoils in the damp. "Harrow Farms has a chandler. Fetch me oil, and quick. I will pay for the oil and for your legs."',
      steps: [{ text: 'Fetch lamp oil from Harrow Farms', visit: 'harrow_farms' }], done: 'The mill burns bright all night and the stones never stop. In the morning the miller sends you off with a warm loaf and flour on both your shoulders where he clapped them.', reward: { gold: 30 } },
    miller_son: { name: 'The Miller\'s Son', giver: 'general', at: 'duskwater_mill', after: 'mill_lamps', offer: 'The miller\'s son has gone off with a pedlar\'s girl, and the miller pretends he only wants his cart back. "Try Ploughman\'s Ford. Then ask about at the tavern in Wheatvale. Somebody will know." He looks at the floor. "Just tell me he is safe."',
      steps: [{ text: 'Check Ploughman\'s Ford', visit: 'ploughmans_ford' }, { text: 'Ask around the tavern at Wheatvale', tavern: 'wheatvale' }], done: 'The boy is well, married at Wheatvale and not coming home. The miller is quiet for a long time. Then he sighs, pays you, and asks whether the girl seemed kind.', reward: { gold: 40, standing: { crown: 10 } } },
    poachers: { name: 'Poachers at the Ford', giver: 'general', at: 'wheatvale', after: null, offer: 'A farmer\'s wife points at a line of snares along the hedge. "The Lord\'s own hares. If he finds them gone, it is the village that pays the fine, not the poachers. And the Lord\'s own men are afraid to go near the camp at Ploughman\'s Ford."',
      steps: [{ text: 'Drive the poachers from Ploughman\'s Ford', flag: 'job_poachers_won' }], done: 'The snares are cut and the camp is empty. The farmer\'s wife gives you what she can spare and says the Lord will never know how close the village came to paying.', reward: { gold: 60, standing: { crown: 15 } } },
    peddlers_trail: { name: 'The Peddler\'s Trail', giver: 'general', at: 'crownwatch_inn', after: null, offer: 'The innkeeper says a pedlar skipped without paying and left a pack of strange tin trinkets behind as security. "Tobb, he calls himself. He drinks at Pilgrim\'s Well or Herald\'s Cross. Ask in the taverns. If you hear where he went, I want to know."',
      steps: [{ text: 'Ask after him at the tavern in Pilgrim\'s Well', tavern: 'pilgrims_well' }, { text: 'Ask after him at the tavern in Herald\'s Cross', tavern: 'heralds_cross' }], done: 'Tobb, it turns out, is good for the money and a long way down the road. The innkeeper pays you for the trouble.', reward: { gold: 25 } },
    fair_price: { name: 'A Fair Price', giver: 'general', at: 'stonebridge', after: null, offer: 'A grain merchant lowers his voice. "Somebody is shorting the weights. A pound in twenty, at Mercers\' Row or the Grain Exchange, maybe both. A pound in twenty is a family\'s winter. Look at the scales and tell me which."',
      steps: [{ text: 'Check the scales at Mercers Row', visit: 'mercers_row' }, { text: 'Check the scales at the Grain Exchange', visit: 'grain_exchange' }], done: 'He thanks you for the report and does not say what he will do with it. In the River Cities, knowing is worth more than telling.', reward: { gold: 40, standing: { syndicate: 10 } } },
    barge_cargo: { name: 'Barge Cargo', giver: 'general', at: 'barge_landing', after: null, offer: 'A bargemaster scratches her head with the end of a pencil. A whole load of seed-grain went missing between the Gilded Ferry and Silt Wharf, and the farmers need it in the ground this month. "Walk the route and ask. Somebody saw something. Somebody always does."',
      steps: [{ text: 'Walk to Gilded Ferry', visit: 'gilded_ferry' }, { text: 'Walk on to Silt Wharf', visit: 'silt_wharf' }], done: 'The grain was never stolen. It was misdelivered to the wrong wharf by a clerk who could not read his own hand. She pays you, and then swears at the clerk for a long and educational time.', reward: { gold: 45, standing: { syndicate: 10 } } },
    cask_trouble: { name: 'Trouble at Cask Hollow', giver: 'general', at: 'weighhouse', after: null, offer: 'The weighhouse keeper jerks his thumb at the south road. "Somebody has taken the old brewery at Cask Hollow. Carts in at night, nothing out by day. I do not think they are brewing, and I do not think they are paying duty either."',
      steps: [{ text: 'Break up the smugglers at Cask Hollow', flag: 'job_cask_won' }], done: 'The keeper counts the cask-stamps you brought back and nods very slowly.', reward: { gold: 70, standing: { syndicate: 15 } } },
    toll_rats: { name: 'Rats in the Toll Cellars', giver: 'general', at: 'tollhouse_quay', after: null, offer: 'The quay-warden has had enough of the Old Toll Cellars. "Something big is nesting down there. The fishermen hear it at night, under the boards, and two of them have stopped coming to work. Clear the place and I will make it worth your while."',
      steps: [{ text: 'Clear the Old Toll Cellars', clear: 'old_toll_cellars' }], done: 'The quay goes quiet at night. The warden digs a small purse and a charm out of a drawer.', reward: { gold: 130, items: { healer_locket: 1 }, standing: { syndicate: 15 } } },
    marches_scout: { name: 'Watching the Marches', giver: 'general', at: 'wayfarers_rest', after: null, offer: 'An innkeeper with a veteran\'s limp wants word from the border posts. "Greywatch, and the Marchwarden\'s Post. I want to know who is on the walls, and how many. Something is building past the border, and the Crown is not telling us anything."',
      steps: [{ text: 'Visit Greywatch Post', visit: 'greywatch_post' }, { text: 'Visit Marchwardens\' Post', visit: 'marchwardens_post' }], done: 'He listens, draws a little map in spilled ale, and nods. "That is about what I feared."', reward: { gold: 40, standing: { crown: 10 } } },
    gallows_gossip: { name: 'Gallows Hill Gossip', giver: 'general', at: 'ragged_fence', after: null, offer: 'A hedge-priest sits on the fence rail and mutters to nobody in particular. "There is a camp on Gallows Hill and nobody will say whose. Ask around at the tavern in Wayfarer\'s Rest, then go and look. Do not go up there first. Nobody comes down who goes up there first."',
      steps: [{ text: 'Ask around the tavern at Wayfarer\'s Rest', tavern: 'wayfarers_rest' }, { text: 'Look at Gallows Hill', visit: 'gallows_hill' }], done: 'He nods and mutters something that might be a blessing, or a plan.', reward: { gold: 30 } },
    gallows_brigands: { name: 'The Brigands of Hobb\'s Reach', giver: 'general', at: 'ragged_fence', after: 'gallows_gossip', offer: 'The hedge-priest finally speaks plainly. "Brigands, a dozen of them, and they have taken the old road at Hobb\'s Reach. They charge my congregation to walk to their own fields. I would like the road back, and I would like them to stop."',
      steps: [{ text: 'Break the brigand camp at Hobb\'s Reach', flag: 'job_brigands_won' }], done: 'The fence-rail congregation cheers. The priest hands over what the road-tolls earned.', reward: { gold: 75, standing: { crown: 15 } } },
    cairn_offerings: { name: 'Cairn Offerings', giver: 'general', at: 'pilgrims_well', after: null, offer: 'A well-keeper presses a bundle of ribbons into your hands, each one tied by a different family. "Prayers for the ones who are not coming home. Half to Oath Cairn, half to Whitestone Abbey, before the first frost. My knees will not make it this year."',
      steps: [{ text: 'Leave the ribbons at Oath Cairn', visit: 'oath_cairn' }, { text: 'Leave the rest at Whitestone Abbey', visit: 'whitestone_abbey' }], done: 'The well-keeper cries a little and gives you what he saved.', reward: { gold: 35, standing: { synod: 10 } } },
    beacon_watch: { name: 'The Beacon Watch', giver: 'general', at: 'aldermere_hold', after: null, offer: 'A steward of Aldermere frowns at his ledgers. "The signal tower and Beacon Hill have both gone quiet, and Lord Osric has not told me why. I would like someone to go and look, and tell me nothing is wrong."',
      steps: [{ text: 'Visit the signal tower', visit: 'signal_tower' }, { text: 'Visit Beacon Hill', visit: 'beacon_hill' }], done: 'Nothing is wrong. Both towers are manned, by Osric\'s own men, under orders to light nothing for anyone but him. The steward thinks this is the most worrying thing he has heard all month.', reward: { gold: 45, standing: { crown: 10 } } }
  });
  C.jobsOf = st => st.world.jobs || (st.world.jobs = {});
  C.jobActive = (st, id) => { const j = C.jobsOf(st)[id]; return !!(j && j.state === 'active'); };
  C.jobDone = (st, id) => { const j = C.jobsOf(st)[id]; return !!(j && j.state === 'done'); };
  C.jobStepDone = (st, job, step, i) => step.flag ? !!st.world.flags[step.flag] : step.tavern ? !!(C.jobsOf(st)[job] && ((st.world.tavern || {})[step.tavern] >= C.jobsOf(st)[job].day)) : step.clear ? (() => { try { return !!C.dungeonStatus(st, step.clear).cleared; } catch (e) { return false; } })() : !!(C.jobsOf(st)[job] && (C.jobsOf(st)[job].seen || {})['s' + i]);
  C.jobReady = (st, id) => C.jobActive(st, id) && C.JOBS[id].steps.every((s, i) => C.jobStepDone(st, id, s, i));
  C.jobOffers = (st, at) => Object.entries(C.JOBS).filter(([id, j]) => j.at === at && !C.jobsOf(st)[id] && (!j.after || C.jobDone(st, j.after))).map(([id, j]) => Object.assign({ id }, j));
  C.jobReports = (st, at) => Object.entries(C.JOBS).filter(([id, j]) => j.at === at && C.jobReady(st, id)).map(([id, j]) => Object.assign({ id }, j));
  C.jobList = st => Object.entries(C.JOBS).filter(([id]) => C.jobsOf(st)[id]).map(([id, j]) => ({ id, name: j.name, giver: j.giver, at: j.at, state: C.jobsOf(st)[id].state, ready: C.jobReady(st, id), steps: j.steps.map((x, i) => ({ text: x.text, done: C.jobStepDone(st, id, x, i) })) }));
  C.acceptJob = function (st, id) {
    const j = C.JOBS[id]; if (!j || C.jobsOf(st)[id]) return { ok: false, reason: 'Not available' };
    if (st.world.location !== j.at) return { ok: false, reason: 'You are not there' };
    if (j.after && !C.jobDone(st, j.after)) return { ok: false, reason: 'Not yet' };
    C.jobsOf(st)[id] = { state: 'active', day: st.world.day, seen: {} };
    return { ok: true };
  };
  // After arriving: tick off 'visit' steps. Returns the names of steps just finished.
  C.jobCheck = function (st) {
    const out = [];
    Object.entries(C.JOBS).forEach(([id, j]) => { if (!C.jobActive(st, id)) return; const js = C.jobsOf(st)[id]; js.seen = js.seen || {};
      j.steps.forEach((x, i) => { if (x.visit && !js.seen['s' + i] && st.world.location === x.visit) { js.seen['s' + i] = 1; out.push({ job: j.name, step: x.text }); } }); });
    return out;
  };
  C.reportJob = function (st, id) {
    const j = C.JOBS[id]; if (!j || !C.jobReady(st, id)) return { ok: false, reason: 'Not finished' };
    if (st.world.location !== j.at) return { ok: false, reason: 'Report to them in person' };
    const R = j.reward || {}, changes = []; C.jobsOf(st)[id].state = 'done'; C.jobsOf(st)[id].doneDay = st.world.day;
    if (R.gold) st.inventory.gold += R.gold;
    for (const [k, n] of Object.entries(R.items || {})) st.inventory.items[k] = (st.inventory.items[k] || 0) + n;
    C.queueLetter(st, id); C.lore(st, 'job_done:' + id);
    for (const [f, d] of Object.entries(R.standing || {})) changes.push(...S().changeStanding(st, f, d, { reason: 'Job: ' + j.name.slice(0, 18) }));
    const found = []; (R.reveal || []).forEach(d => { const r = C.reveal(st, d); if (r && r.ok) found.push(C.NODES[d].name); });
    return { ok: true, gold: R.gold || 0, items: R.items || null, changes, found, text: j.done };
  };

  // ---- taverns: rumours, overheard talk, hints and small choices ----
  // A tavern stands in every town, village, market and capital. One visit a day per tavern, for a few coins. Scenes are seeded by place, day and visit count, so reloading does not reroll them.
  // Kinds: rumour (reveals a hidden place nearby, or points at a job), overheard (faction squabbles that follow the relations as they shift, and gossip about what you did), hint (dungeon levels, rules of the road) and choice (take a side, buy a round).
  C.TAVERN = { cost: 3, types: ['town', 'village', 'market', 'capital'], weights: { rumour: 30, overheard: 40, hint: 16, whisper: 9, choice: 14 } };
  C.TV_PEOPLE = {
    any: ['a drover with mud to the knee', 'a ferrywoman nursing one cup', 'a one-eyed carter', 'two off-duty guards', 'a tinker counting coins', 'a widow with a ledger', 'a young priest at the corner table', 'a poet who is not sober', 'a cooper wiping his hands', 'a sellsword past her prime'],
    crownlands: ['a tithe clerk', 'a retired halberdier', 'a steward on his day off'], free_marches: ['a woodcutter', 'a trapper with a pelt over one shoulder', 'a bargeman'],
    river_cities: ['a lock-keeper', 'a dockhand', 'a chandler with rope burns'], voldun: ['a gaunt miller', 'a pilgrim with ink on her fingers', 'a gravedigger'],
    elven_realms: ['a leaf-cloaked scout', 'a herbalist', 'a long-limbed archer who does not drink'], dwarven_holds: ['a soot-faced miner', 'a stonemason', 'a bearded clerk with a chisel'],
    iceflow: ['a whaler', 'a fur-trader', 'a ferryman who has seen the ice break'], orc_lands: ['a scarred drover', 'a quarry boss', 'a clan courier'], goblin_fens: ['a reed-cutter', 'a mud-spattered runner', 'a toothy barkeep']
  };
  C.TV_TALK = { // pride: what its friends say; sore: what its critics say
    crown: ['The Crown keeps the roads open and the toll barns full.', 'The Crown takes the grain twice, once as tithe and once as a "loan".', 'The Crown sends a sergeant when you are robbed. Eventually.', 'Twelve years without a king and the roads still work. Say what you like about the lords.'],
    syndicate: ['The Syndicate paid for the new bridge when the Crown could not.', 'The Syndicate lends you a coin and owns your well.', 'A Syndicate receipt is the only promise in this realm anybody keeps.', 'They never lie. They just write the truth very small.'],
    synod: ['The Synod fed half this town through the bad winter.', 'The Synod writes down what you confess and never forgets it.', 'The wards on the well are Synod work. Nobody has drowned in it since.', 'My cousin went to Vol\'Dun to be registered. That was four years ago.'],
    ivory: ['The Spire\'s mages mended our well-water in a night.', 'The Spire answers a question with a longer question.'],
    canopy: ['The Wardens keep the old trees standing.', 'The Wardens call an axe handle a crime.'],
    matriarchy: ['The Matriarchy has never lost a debt owed to it.', 'Nobody has seen a Matriarchy envoy smile or leave a debt unpaid.'],
    cabal: ['The Cabal knows what the Matriarchy would rather it did not.', 'The Cabal pays in secrets, and secrets do not buy bread.'],
    envoys: ['The Envoys trade fair, even with those who spat at them.', 'The Envoys come up from the dark with new prices every spring.'],
    ironbound: ['Ironbound oaths are cut in stone and kept.', 'An Ironbound clansman holds a grudge longer than a mountain holds snow.'],
    anvil: ['The Anvil guild made the tools that built this town.', 'The Anvil would mine a grave if the ore ran true.'],
    blood_iron: ['The Legion\'s champions earned every scar.', 'The Legion counts a village as a supply depot.'],
    ash_speakers: ['The Ash-Speakers remember what the Legion burned.', 'The Ash-Speakers talk to cinders and call it counsel.'],
    bilge_rats: ['The Cartel gets cargo through where the Crown\'s seals cannot.', 'The Cartel\'s tunnels keep opening under people\'s cellars.'],
    mire_born: ['The Mire-Born know every drowned path in the fens.', 'The Mire-Born took the old causeway and call it a tax.'],
    seraphic: ['The Seraphic Host stood on the wall the night the sky broke.', 'The Host judges before it listens.'],
    dawn: ['The Choir sings the wounded back to health.', 'The Choir\'s hymns stop at a sinner\'s door.'],
    vigilant: ['The Vigilant never sleep on a watch.', 'The Vigilant watch everything, you included.'],
    cinder: ['The Cinder-Crown pays its soldiers in iron and truth.', 'The Cinder-Crown\'s truth comes with a brand.'],
    whisper: ['The Whisper-Pact always keeps the letter of a bargain.', 'The Whisper-Pact keeps the letter and takes the rest.'],
    reavers: ['The Reavers laugh at walls.', 'The Reavers laugh at the walls and then at what is behind them.'],
    broken_banner: ['The Broken Banner still fights for the soldiers the Crown forgot.', 'The Broken Banner robs a cart and calls it a levy.', 'When the raiders came, it was the Banner rode in. Not the Crown.'],
    hearthwatch: ['The Hearthwatch lets a hunted man sleep.', 'The Hearthwatch asks nothing, and that is what worries me.', 'Mother Agathe has buried more people than the plague. Some of them twice, they say.'],
    outlaws: ['The roadmen out in the wild take no side but their own.', 'A raider is a raider whatever flag he once flew.']
  };
  C.TV_PAIRS = { // hand-written squabbles for the old rivalries (key: a|b, either order)
    'crown|syndicate': [[['The Crown built these roads.', 'And the Syndicate keeps the carts on them. Who pays for that?'], ['Everyone pays the Crown.', 'Everyone pays the Syndicate too, and gets a receipt.'], ['Then why do both of them fill my cellar with sealed crates?', null]],
      [['They say the Syndicate bought the old tollhouse.', 'The Crown sold it to them.'], ['The Crown sold what it should have kept.', 'The Crown sold what it could not afford to keep. There is a difference.']]],
    'synod|syndicate': [[['The Synod fed this town when the Syndicate raised the price of flour.', 'The Synod fed it on borrowed flour. Guess whose.'], ['Charity with a ledger behind it is still charity.', 'Then the chantry bell is a debt-bell.']],
      [['A Syndicate factor was in the chantry again.', 'Paying for a roof, I heard.'], ['A roof with his name carved on it.', 'Better his name than a hole.']]],
    'ironbound|anvil': [[['An Ironbound hold never sold a mountain.', 'An Ironbound hold never built a road either.'], ['The Anvil digs where the clans bury their dead.', 'Then the clans should bury them somewhere less rich.']]],
    'blood_iron|ash_speakers': [[['The Legion wins, and the ashes follow.', 'The ashes remember, and the Legion forgets.'], ['Say that outside.', 'I will. Out loud. Where the cinders can hear.']]],
    'bilge_rats|mire_born': [[['The Cartel dug under the old causeway.', 'The causeway was ours before it was anybody\'s.'], ['Ours, theirs. The tunnel pays whoever holds the lamp.', 'Then hold your lamp somewhere the water cannot reach.']]],
    'canopy|crown': [[['The Crown wants timber for ships.', 'The Wardens want the Crown\'s axemen out of the wood.'], ['A tree is a tree.', 'Not to the ones who planted it.']]]
  };
  C.TV_GOSSIP = [ // talk about you; each is told once
    { id: 'g_fight', if: st => !!st.world.flags.g_fight, lines: ['Somebody put the debt-collectors in the ditch out at the Golden Reach.', 'A hero or a thief, depending who you ask. Three in the party, I heard.'] },
    { id: 'toll', if: st => C.jobDone(st, 'toll_road'), lines: ['The Tithe Barn road is open again. The sergeants are telling it like they did it.', 'It was a stranger with a small party. The sergeants would rather you forgot.'] },
    { id: 'debt', if: st => C.jobDone(st, 'pennant_debt'), lines: ['The Pennant Green farmer paid up in the end.', 'Nobody asked how. That is how the Syndicate likes it.'] },
    { id: 'letter', if: st => C.jobDone(st, 'sealed_letter'), lines: ['The clerks at Orchard Row swear the pilgrim\'s seal was never broken.', 'Funny. They swear it a little too hard.'] },
    { id: 'barrow', if: st => C.jobDone(st, 'barrow_whispers'), lines: ['They say the steward at Crown Keep has gone grey since he sent a stranger to the Barrow.', 'Lights in a tomb. I would go grey too.'] },
    { id: 'cellar', if: st => C.jobDone(st, 'cellar_ledger'), lines: ['The Syndicate\'s factor is smiling again, and it is not the nice kind.', 'Folk have stopped walking past Applecourt after dark.'] },
    { id: 'mage', if: st => C.jobDone(st, 'hedge_mage'), lines: ['The hedge-mage left Pale Vigil in a hurry.', 'The chantry clerks are not saying why. The chantry clerks are always saying why.'] },
    { id: 'hostile', if: st => Object.keys(window.GAME_DATA.factions).some(f => f !== 'outlaws' && S().standingTier(st, f).id === 'hostile' && S().isMet(st, f)), lines: st => ['There are notices up in the next town. Somebody matching a party like yours.', 'Said nothing, did I? Not yet.'] },
    { id: 'sworn', if: st => !!st.factions.allegiance, lines: st => ['Is that ' + C.tvName(st.factions.allegiance) + ' colours on that one?', 'It is. Mind your tongue about them tonight.'] },
    { id: 'dungeon', if: st => Object.keys(C.DUNGEONS).some(d => { try { return C.dungeonStatus(st, d).cleared; } catch (e) { return false; } }), lines: ['They say somebody walked out of the dark under the hills and came back with their pockets full.', 'And their party in one piece. That is the strange part.'] }
  ];
  C.TV_HINTS = [
    'Whoever holds the high ground shoots farther. Put your archers on the hill and let them come up to you.',
    'A Rogue can climb two steps where others climb one. There is not a cliff in the world that stops a good one.',
    'Shopkeepers charge you more the less they like you, and stop talking to you at all if it gets bad enough.',
    'If a faction puts a price on your head, the Syndicate will take coin to look away, and the Hearthwatch will take penance.',
    'Some places, trouble finds you. The word is on the map. Walk in and out a few times and you will see.',
    'Rest at a Hearthwatch sanctuary and old trails go cold. They ask nothing in return.',
    'The deeper floors of a dungeon pay more, but if you lose, you start over from the top. Know when to leave.',
    'Do not fight a dungeon far above your level; the people with the money say it is not worth the ride.'
  ];
  C.tvName = f => { const F = window.GAME_DATA.factions[f], n = F ? F.name : f; return /^the /i.test(n) ? n : 'the ' + n; };
  const tvRng = seed => { let a = 7; for (const c of seed) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const tvPick = (r, a) => a[Math.floor(r() * a.length)];
  C.hasTavern = id => !!(C.NODES[id] && C.TAVERN.types.includes(C.NODES[id].type));
  C.tavernState = function (st, id, sv) {
    if (!C.hasTavern(id)) return null;
    sv = sv || C.nodeServices(st, id); if (!sv || !sv.open || sv.besieged) return null;
    const w = st.world.tavern || {};
    return { cost: C.calendar(st.world.day).festival ? 0 : C.TAVERN.cost, doneToday: w[id] === st.world.day };
  };
  // hops from here to each place (hidden places included), for "nearby" rumours
  function tvDist(from) { const d = { [from]: 0 }, q = [from]; while (q.length) { const x = q.shift(); Object.keys((C.NODES[x] || { links: {} }).links).forEach(y => { if (d[y] === undefined) { d[y] = d[x] + 1; q.push(y); } }); } return d; }
  function tvJobGated() { const s = new Set(); Object.values(C.JOBS).forEach(j => ((j.reward || {}).reveal || []).forEach(d => s.add(d))); return s; }
  function tvRumour(st, id, r) {
    const dist = tvDist(id), gated = tvJobGated(), out = [];
    const hid = Object.keys(C.NODES).filter(k => C.NODES[k].hidden && !st.world.flags['reveal_' + k] && !gated.has(k) && dist[k] !== undefined && dist[k] <= 3);
    const told = st.world.tvSeen || (st.world.tvSeen = {}), jobs = Object.entries(C.JOBS).filter(([k, j]) => !told['job_' + k] && !C.jobsOf(st)[k] && j.at !== id && C.isDiscovered(st, j.at) && (!j.after || C.jobDone(st, j.after)));
    const opts = []; if (hid.length) opts.push('place'); if (jobs.length) opts.push('job'); if (!opts.length) return null;
    const who = tvPick(r, (C.TV_PEOPLE[C.NODES[id].region] || []).concat(C.TV_PEOPLE.any)), kind = tvPick(r, opts);
    if (kind === 'job') { const [k, j] = tvPick(r, jobs); told['job_' + k] = 1; return { kind: 'rumour', title: 'A rumour', lines: [{ who, text: j.giver === 'general' ? 'I hear folk at ' + C.NODES[j.at].name + ' need a hand with something. Honest work, modest pay.' : 'I hear ' + C.tvName(j.giver) + ' have work going at ' + C.NODES[j.at].name + '. Quiet work, the paying kind.' }], found: [] }; }
    const t = tvPick(r, hid), n = C.NODES[t]; C.reveal(st, t);
    const d = C.DUNGEONS[t], text = d ? n.name + '. ' + n.desc + ' Folk say it is level ' + d.rec + ' work, and no kinder.' : 'Have you heard of ' + n.name + '? ' + n.desc;
    return { kind: 'rumour', title: 'A rumour', lines: [{ who, text }], found: [n.name], narr: n.name + ' is now on your map.' };
  }
  function tvPool(st, id) { // factions the talk can name: the local owner, those you have met, and owners of nearby places
    const s = new Set(), o = C.ownerOf(st, id) || C.NODES[id].faction; if (o && window.GAME_DATA.factions[o]) s.add(o);
    Object.keys(window.GAME_DATA.factions).forEach(f => { if (S().isMet(st, f)) s.add(f); }); const dist = tvDist(id);
    Object.keys(C.NODES).forEach(k => { if (dist[k] !== undefined && dist[k] <= 2) { const f = C.ownerOf(st, k) || C.NODES[k].faction; if (f && window.GAME_DATA.factions[f]) s.add(f); } });
    if (['crown', 'syndicate', 'synod'].includes(o)) ['crown', 'syndicate', 'synod'].forEach(f => s.add(f)); // the starting country always has its three powers in the room
    ['outlaws', 'hearthwatch'].forEach(f => s.delete(f)); return [...s].filter(f => C.TV_TALK[f]);
  }
  function tvSquabble(st, id, r) {
    const pool = tvPool(st, id), pairs = [], own = C.ownerOf(st, id);
    for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) { const a = pool[i], b = pool[j], rel = (S().getRelation(st, a, b) + S().getRelation(st, b, a)) / 2; if (rel <= -0.25) pairs.push({ a, b, rel, w: (-rel * 10 + (C.TV_PAIRS[a + '|' + b] || C.TV_PAIRS[b + '|' + a] ? 6 : 0) + [a, b].reduce((t, f) => t + (f === own ? 6 : 0) + (S().isMet(st, f) ? 4 : 0), 0)) / (1 + ((st.world.tvSeen || {})['p_' + a + '|' + b] || 0) * 1.5) }); }
    if (!pairs.length) return null;
    let tot = pairs.reduce((s, p) => s + p.w, 0), x = r() * tot, p = pairs[0]; for (const q of pairs) { x -= q.w; if (x <= 0) { p = q; break; } }
    const reg = C.NODES[id].region, pe = C.TV_PEOPLE[reg] || [], s1 = tvPick(r, pe.concat(C.TV_PEOPLE.any)); let s2 = tvPick(r, C.TV_PEOPLE.any); if (s2 === s1) s2 = 'a stranger at the bar';
    const sn = st.world.tvSeen || (st.world.tvSeen = {}); sn['p_' + p.a + '|' + p.b] = (sn['p_' + p.a + '|' + p.b] || 0) + 1;
    const hv = C.TV_PAIRS[p.a + '|' + p.b] || C.TV_PAIRS[p.b + '|' + p.a], cnt = sn['p_' + p.a + '|' + p.b], hand = hv && cnt <= hv.length ? hv[cnt - 1] : null, lines = [];
    if (hand) { hand.forEach(ex => ex.forEach(t => { if (t) lines.push({ who: lines.length % 2 ? s2 : s1, text: t }); })); }
    else { const A = C.TV_TALK[p.a], B = C.TV_TALK[p.b], shape = Math.floor(r() * 3);
      if (shape === 0) lines.push({ who: s1, text: A[0] }, { who: s2, text: A[1] }, { who: s1, text: tvPick(r, ['Say that again.', 'Watch your mouth.', 'Not in here, friend.']) });
      else if (shape === 1) lines.push({ who: s2, text: B[0] }, { who: s1, text: B[1] }, { who: s2, text: tvPick(r, ['You would say that.', 'Ask anyone.', 'Drink your drink.']) });
      else lines.push({ who: s1, text: A[0] }, { who: s2, text: A[1] }, { who: s1, text: B[1] }, { who: s2, text: B[0] }); }
    let narr = tvPick(r, ['The barkeep sets a jug between them and the heat goes out of it, for now.', 'Somebody starts a song to drown them out. It nearly works.', 'They are still at it when you finish your cup.']);
    const base = (window.GAME_DATA.factions[p.a].relations || {})[p.b] || 0, now = S().getRelation(st, p.a, p.b);
    if (now - base >= 0.15) narr = 'It was not always this friendly between them. Folk say it has been thawing.'; else if (base - now >= 0.15) narr = 'It was not always this bitter between them. It is now.';
    return { kind: 'overheard', title: 'Overheard', lines, narr, pair: [p.a, p.b] };
  }
  function tvGossip(st, r) {
    const seen = st.world.tvSeen || (st.world.tvSeen = {}), ok = C.TV_GOSSIP.filter(g => !seen[g.id] && g.if(st)); if (!ok.length) return null;
    const g = tvPick(r, ok), ls = typeof g.lines === 'function' ? g.lines(st) : g.lines; seen[g.id] = 1;
    return { kind: 'overheard', title: 'Overheard', lines: ls.map((t, i) => ({ who: i ? 'the other' : 'a patron', text: t })), narr: 'They stop when they notice you looking.' };
  }
  function tvHint(st, id, r) {
    const ds = Object.keys(C.DUNGEONS).filter(d => C.isDiscovered(st, d) && !(() => { try { return C.dungeonStatus(st, d).cleared; } catch (e) { return false; } })());
    const who = tvPick(r, (C.TV_PEOPLE[C.NODES[id].region] || []).concat(C.TV_PEOPLE.any));
    if (ds.length && r() < 0.5) { const d = C.DUNGEONS[tvPick(r, ds)]; return { kind: 'hint', title: 'A word of advice', lines: [{ who, text: d.name + '? Go in at level ' + d.rec + ' or not at all. ' + (d.why || '') }] }; }
    const sn = st.world.tvSeen || (st.world.tvSeen = {}); let fresh = C.TV_HINTS.filter((h, i) => !sn['h' + i]); if (!fresh.length) { C.TV_HINTS.forEach((h, i) => delete sn['h' + i]); fresh = C.TV_HINTS; } const h = tvPick(r, fresh); sn['h' + C.TV_HINTS.indexOf(h)] = 1;
    return { kind: 'hint', title: 'A word of advice', lines: [{ who, text: h }] };
  }
  function tvChoice(st, id, r, sq) {
    const owner = C.ownerOf(st, id), kinds = ['round', 'news']; if (sq && sq.pair) kinds.push('side', 'side');
    const k = tvPick(r, kinds);
    if (k === 'side') { const [a, b] = sq.pair, A = C.tvName(a), B = C.tvName(b); return { id: 'side', text: 'The argument turns to you. "Well? Whose side are you on?"', options: [
      { id: 'a', label: 'Back ' + A, hint: A.charAt(0).toUpperCase() + A.slice(1) + ' will remember it. So will ' + B + '.', standing: { [a]: 15, [b]: -10 }, relations: [[a, b, -0.05, true]] }, { id: 'b', label: 'Back ' + B, hint: B.charAt(0).toUpperCase() + B.slice(1) + ' will remember it. So will ' + A + '.', standing: { [b]: 15, [a]: -10 }, relations: [[a, b, -0.05, true]] },
      { id: 'calm', label: 'Buy them both a drink (15 gold)', hint: 'Nobody wins. Everybody is a little grateful.', gold: -15, standing: { [a]: 5, [b]: 5 }, relations: [[a, b, 0.05, true]] }, { id: 'out', label: 'Stay out of it' }] }; }
    if (k === 'news') return { id: 'news', text: 'The keeper wipes a cup and watches you. "I hear more than I say. Fifteen gold says more."', options: [{ id: 'pay', label: 'Pay for news (15 gold)', hint: 'Fifteen gold for something worth hearing.', gold: -15, rumour: true }, { id: 'no', label: 'No, thanks' }] };
    return { id: 'round', text: 'A song starts up. The table looks hopefully at your purse.', options: [{ id: 'buy', label: 'Buy a round (20 gold)', hint: 'A warm table and loose tongues. The place remembers a generous stranger.', gold: -20, standing: owner && C.TV_TALK[owner] ? { [owner]: 10 } : {}, rumour: true }, { id: 'no', label: 'Hum along and keep your coin' }] };
  }
  C.tavernVisit = function (st, id) {
    if (st.world.location !== id) return { ok: false, reason: 'You are not there' };
    const ts = C.tavernState(st, id); if (!ts) return { ok: false, reason: 'No tavern open here' };
    if (ts.doneToday) return { ok: false, reason: 'You have had your fill here today' };
    if (st.inventory.gold < ts.cost) return { ok: false, reason: 'You cannot afford a cup (' + ts.cost + ' gold)' };
    st.world.tavern = st.world.tavern || {}; st.world.tvCount = (st.world.tvCount || 0) + 1; st.world.tavern[id] = st.world.day; st.inventory.gold -= ts.cost;
    const r = tvRng(id + '|' + st.world.day + '|' + st.world.tvCount), recent = st.world.tvRecent || (st.world.tvRecent = []), W = C.TAVERN.weights;
    const kinds = Object.keys(W).filter(k => k !== 'choice'); let sc = null, sq = null;
    const first = st.world.tvCount === 1; const order = []; const bag = kinds.slice(); // weighted draw without the kind used last time
    while (bag.length) { const tot = bag.reduce((s, k) => s + W[k] * (k === recent[recent.length - 1] ? .3 : 1), 0); let x = r() * tot, ch = bag[0]; for (const k of bag) { x -= W[k] * (k === recent[recent.length - 1] ? .3 : 1); if (x <= 0) { ch = k; break; } } order.push(ch); bag.splice(bag.indexOf(ch), 1); }
    if (first) order.unshift('rumour');
    for (const k of order) {
      if (k === 'rumour') sc = tvRumour(st, id, r); else if (k === 'whisper') sc = tvWhisper(st, id, r); else if (k === 'overheard') { sc = (r() < 0.4 ? tvGossip(st, r) : null) || tvSquabble(st, id, r) || tvGossip(st, r); } else sc = tvHint(st, id, r);
      if (sc) break;
    }
    if (!sc) sc = tvHint(st, id, r);
    if (sc.pair) { sq = sc; const pr = sc.pair.slice().sort().join('|'); C.lore(st, 'squab:' + pr); sc.pair.forEach(f => { C.learn(st, 'tv_' + f + '_p', 'Overheard in a tavern'); C.learn(st, 'tv_' + f + '_s', 'Overheard in a tavern'); }); }
    recent.push(sc.kind); if (recent.length > 4) recent.shift();
    st.world.tvPending = null;
    if (r() * 100 < W.choice && sc.kind !== 'rumour') { const ch = tvChoice(st, id, r, sq); sc.choice = { id: ch.id, text: ch.text, options: ch.options.map(o => ({ id: o.id, label: o.label, hint: o.hint || null })) }; st.world.tvPending = { id: ch.id, options: ch.options, at: id }; }
    return { ok: true, scene: sc, cost: ts.cost };
  };
  C.tavernChoose = function (st, optId) {
    const p = st.world.tvPending; if (!p) return { ok: false, reason: 'Nothing to decide' };
    const o = p.options.find(x => x.id === optId); if (!o) return { ok: false, reason: 'Unknown option' };
    if (o.gold < 0 && st.inventory.gold < -o.gold) return { ok: false, reason: 'Not enough gold' };
    const changes = []; for (const [f, d] of Object.entries(o.standing || {})) changes.push(...S().changeStanding(st, f, d, { reason: 'Tavern talk' }));
    if (o.gold) st.inventory.gold += o.gold; for (const [a, b, d, both] of o.relations || []) S().shiftRelation(st, a, b, d, { both });
    let found = []; if (o.rumour) { const r = tvRng(p.at + '|' + st.world.day + '|' + st.world.tvCount + '|c'), rr = tvRumour(st, p.at, r); if (rr) found = rr.found; var rumour = rr; }
    st.world.tvPending = null; return { ok: true, changes, found, rumour: rumour || null, gold: o.gold || 0 };
  };

  // ---- a living world: seasons and festivals, place events, arrival lines, notice boards, rotating shops, recurring people, road sights and letters ----
  // Everything here is derived from the day number and the place (no saved state beyond who you have met and the letters in the post), so it costs nothing to keep and reloading never changes it.
  const hsh = s => { let a = 2166136261; for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619); } return (a >>> 0); };
  const hpick = (a, s) => a[hsh(s) % a.length];
  C.SEASONS = [{ id: 'thaw', name: 'Thaw', fest: 'the Sowing Fair' }, { id: 'sun', name: 'High Sun', fest: 'the Sunwake Fair' }, { id: 'glean', name: 'Gleaning', fest: 'Harvest Home' }, { id: 'frost', name: 'Frostfall', fest: 'Longnight' }];
  C.calendar = function (day) { const y = Math.floor(day / 120), d = day % 120, s = Math.floor(d / 30), n = d % 30; return { season: C.SEASONS[s], dayOfSeason: n + 1, year: y + 1, festival: n === 14 ? C.SEASONS[s].fest : null, festivalIn: n < 14 ? 14 - n : null }; };
  C.EVENT_KINDS = {
    boom: { name: 'Market boom', mult: 0.9, line: 'Stalls are packed and prices are soft; everyone is trying to sell.' },
    shortage: { name: 'Shortage', mult: 1.12, line: 'Shelves are bare in places and the sellers know it.' },
    fair: { name: 'Travelling fair', mult: 1, line: 'A fair has rolled in: jugglers, a bear on a chain, and a queue for pies.' },
    scare: { name: 'Raid scare', mult: 1, line: 'Shutters are half closed. Someone saw riders on the ridge last night.' },
    mourning: { name: 'Mourning', mult: 1, line: 'Black ribbons hang on the doors. Voices are low.' }
  };
  C.placeEvent = function (st, id) {
    const n = C.NODES[id]; if (!n || !['town', 'village', 'market', 'hamlet', 'capital'].includes(n.type)) return null;
    const day = st.world.day, per = Math.floor(day / 6), h = hsh(id + '|ev|' + per);
    if (h % 100 >= 14) return null;
    const kind = ['boom', 'shortage', 'fair', 'scare', 'mourning'][(h >>> 8) % 5];
    return Object.assign({ id: kind, until: (per + 1) * 6 }, C.EVENT_KINDS[kind]);
  };
  C.shopMult = function (st, id) { const e = C.placeEvent(st, id), cal = C.calendar(st.world.day); let m = e ? e.mult : 1; if (cal.festival && ['town', 'market', 'capital'].includes(C.NODES[id].type)) m *= 0.9; return m; };
  const SHOP_POOL = () => { const s = new Set(); Object.values(C.NODES).forEach(n => (n.shop || []).forEach(g => s.add(g))); return [...s].sort(); };
  C.rotateStock = function (st, id, base) { // a few things sell out or turn up as the days pass; changes every four days
    const per = Math.floor(st.world.day / 4), out = base.slice(), notes = []; if (!base.length) return { stock: out, notes };
    if (base.length >= 3 && hsh(id + '|out|' + per) % 3 === 0) { const g = out.splice(hsh(id + '|o2|' + per) % out.length, 1)[0]; notes.push({ out: g }); }
    if (hsh(id + '|ped|' + per) % 100 < 40) { const pool = SHOP_POOL().filter(g => !out.includes(g) && !base.includes(g)); if (pool.length) { const g = pool[hsh(id + '|p2|' + per) % pool.length]; out.push(g); notes.push({ pedlar: g }); } }
    return { stock: out, notes };
  };
  C.TV_ARRIVE = {
    type: {
      town: ['Smoke from a hundred chimneys, and a market bell somewhere.', 'Carts jam the main street and nobody is giving way.', 'A town crier clears his throat and thinks better of it.', 'Dogs, children and a very patient mule hold the square.'],
      village: ['A handful of roofs and one very loud rooster.', 'Washing flaps between the houses and children stop to stare.', 'The well has a queue, and the queue has opinions.', 'Someone is mending a fence and talking the whole time.'],
      hamlet: ['A few houses and a lot of sky.', 'A single lamp burns in a window, though it is not yet dusk.', 'The place smells of woodsmoke and wet straw.', 'Nobody is about, but a kettle is steaming.'],
      castle: ['Banners hang limp above the gate and the guards look you over twice.', 'Boots echo on the wall walk. Somebody is always watching.', 'The portcullis is half raised, as if the place is making up its mind.', 'A drill sergeant\'s voice carries over the yard.'],
      market: ['Stalls pressed so tight a cat would have to turn sideways.', 'Haggling rises and falls like surf.', 'A scale clinks. A scale always clinks.', 'Every second voice is shouting a price.'],
      capital: ['Bells, banners and too many people for the streets.', 'The great hall\'s shadow falls across the whole square.', 'Messengers sprint past in three different liveries.', 'Even the beggars look like they have opinions about policy.'],
      poi: ['The place is quiet in a way that feels deliberate.', 'Old stone, older stories.', 'Something here has been left alone for a long time.', 'Wind finds every gap in the ruin and whistles through it.'],
      zone: ['The land feels watchful.', 'Tracks cross the path, none of them friendly.', 'Birds go quiet as you come in.', 'Nobody lives here. Nobody sensible, anyway.']
    },
    owner: {
      crown: ['The royal colours are everywhere, freshly pressed.', 'A tax notice flutters on the door post.', 'A sergeant in a clean tabard watches the road.'],
      syndicate: ['A ledger-clerk in every doorway.', 'Everything has a price tag, even the water trough.', 'The lamplighters wear Syndicate grey, and the lamps are bright.'],
      synod: ['A chantry bell rings the hour and everyone pauses.', 'Pilgrims shuffle through the streets, quiet and hungry.', 'A priest watches you pass and writes something down.'],
      hearthwatch: ['A lantern burns at every door, no matter the hour.', 'Nobody asks your name here. It is a relief.', 'The Hearthwatch have set a kettle on the green for any who need it.'],
      broken_banner: ['Patched cloaks, hard eyes, and a lot of old swords.', 'Someone is singing a marching song with the words changed.'],
      outlaws: ['Doors are barred, and a hard-faced man leans on the post and does not move.']
    },
    season: {
      thaw: ['Meltwater runs in every gutter.', 'The first green is coming through the mud.', 'Plough teams are out, and so are the mud-wrestling children.'],
      sun: ['Heat shimmers off the roofs.', 'Dust hangs in the air and every dog is flat in the shade.', 'The long evening light turns everything gold.'],
      glean: ['The smell of cut straw and cider on the wind.', 'Sheaves are stacked high against every wall.', 'Wagons groan under apples, grain and the occasional pig.'],
      frost: ['Breath hangs in the air and every chimney is working hard.', 'Frost has rimed the thatch and the water butt.', 'Folk are bundled to the eyes and not inclined to talk.']
    }
  };
  C.placeLine = function (st, id) {
    const n = C.NODES[id]; if (!n) return null; const day = st.world.day, cal = C.calendar(day), ev = C.placeEvent(st, id), T = C.TV_ARRIVE, seed = id + '|' + day;
    if (cal.festival && ['town', 'village', 'market', 'capital'].includes(n.type)) return 'It is ' + cal.festival + '. Ribbons on every post and music from every door.';
    if (ev && hsh(seed + 'e') % 3) return ev.line;
    const owner = C.ownerOf(st, id), pools = [].concat(T.type[n.type] || [], T.type[n.type] || [], T.type[n.type] || [], (T.owner[owner] || []).concat(T.owner[owner] || []), T.season[cal.season.id], T.season[cal.season.id]);
    return hpick(pools, seed);
  };
  C.noticeBoard = function (st, id) { // headlines from the real state of the world
    const n = C.NODES[id], out = [], dist = tvDist(id), cal = C.calendar(st.world.day);
    if (!['town', 'market', 'capital', 'castle'].includes(n.type)) return null;
    const own = C.ownerOf(st, id); if (own && window.GAME_DATA.factions[own]) out.push(C.tvName(own).replace(/^the /, 'The ') + ' holds this place and reminds all travellers of the road laws.');
    if (cal.festival) out.push(cal.festival[0].toUpperCase() + cal.festival.slice(1) + ' is today. Prices are lowered in the markets.'); else if (cal.festivalIn <= 6) out.push(cal.season.fest[0].toUpperCase() + cal.season.fest.slice(1) + ' is in ' + cal.festivalIn + ' day' + (cal.festivalIn > 1 ? 's' : '') + '. Stalls are being put up.');
    Object.keys(C.NODES).filter(k => dist[k] !== undefined && dist[k] <= 2 && k !== id).forEach(k => { const e = C.placeEvent(st, k); if (e && out.length < 5) out.push(e.name + ' at ' + C.NODES[k].name + ' until day ' + e.until + '.'); });
    const here = C.placeEvent(st, id); if (here) out.unshift(here.name + ' here until day ' + here.until + '. ' + here.line);
    const ov = st.factions && st.factions.relationOverrides || {}; Object.keys(ov).slice(-2).forEach(k => { const [a, b] = k.split('>'), base = (window.GAME_DATA.factions[a] && window.GAME_DATA.factions[a].relations || {})[b] || 0; if (Math.abs(ov[k] - base) >= 0.1 && a < b) out.push(ov[k] < base ? C.tvName(a).replace(/^the /, 'The ') + ' and ' + C.tvName(b) + ' are said to be at odds.' : C.tvName(a).replace(/^the /, 'The ') + ' and ' + C.tvName(b) + ' are said to be easing off.'); });
    Object.keys(C.DUNGEONS).filter(d => { try { return C.dungeonStatus(st, d).cleared; } catch (e) { return false; } }).slice(0, 1).forEach(d => out.push('Word is that ' + C.DUNGEONS[d].name + ' has been cleared. Adventurers are asking where the loot went.'));
    const open = Object.entries(C.JOBS).filter(([k, j]) => j.giver === 'general' && j.at === id && !C.jobsOf(st)[k] && (!j.after || C.jobDone(st, j.after)));
    open.forEach(([k, j]) => { (st.world.tvSeen = st.world.tvSeen || {})['job_' + k] = 1; out.push('WANTED: ' + j.name + '. Ask here.'); });
    if (!out.length) out.push('Nothing but a faded notice about stray dogs.');
    return out.slice(0, 5);
  };
  C.NPCS = {
    tobb: { name: 'Tobb the Pedlar', desc: 'a pedlar under a pack taller than he is', route: ['kingsway_cross', 'harrow_farms', 'rivermeet', 'heralds_cross', 'wheatvale', 'pennant_green', 'canalgate'],
      lines: ['"New face! Every face is a customer to Tobb. Mind the left strap, it bites. Tin rings, needles, a very nearly silver spoon. No? Tobb will see you again. Tobb sees everybody again."', '"You again! Good. Repeat customers live longest. Tobb has a theory about that, but it costs a copper."', '"I stopped counting miles years ago. I count faces. Yours I know. Crown faces are tired, Syndicate faces are counting, Synod faces are listening. Yours is still making up its mind."', '"A lord\'s man bought every tin ring Tobb had, last week. Said they were for a wedding. Tobb has sold rings to weddings. That was not a wedding. That was an army that wanted to look married."', '"Tobb\'s advice, free, once only: when the great folk start buying, sell. When they start borrowing, leave town."', '"Still here? Still buying? Tobb is touched. Tobb is also out of spoons."'],
      react: [{ if: st => C.jobDone(st, 'toll_road'), text: '"They say the Tithe Barn road is open. Tobb will be using it, so Tobb thanks you, and so do Tobb\'s feet."' }, { if: st => !!st.world.flags.g_fight, text: '"I saw the Golden Reach from the road. The ditch was full of debt-collectors. Bold! The Syndicate does not like its collectors in ditches. Tobb would buy you a drink, but Tobb would like to keep his customers."' }] },
    maren: { name: 'Sister Maren', desc: 'a travelling pilgrim with a patched Synod mantle', route: ['pennant_green', 'pilgrims_well', 'wheatvale', 'applecourt', 'millstream'],
      lines: ['"Peace on the road. Have you eaten? I have bread, and an opinion about everything, and I will give you both whether you want them or not."', '"The same road twice. Perhaps there is a reason. I was taught there always is. I am less sure than I was, but I still look for it."', '"I pray for the faces I know. You are on the list now, and you do not get a say." She breaks her bread in half. "The Synod says magic must be written down to be safe. I believed that for twenty years. Lately I have been counting the people who go to Vol\'Dun to be written down."', '"I have counted them now. Mages taken \'for questioning\' to Vol\'Dun. None of them come back. Not one, in all the years I have walked this road." She does not look at you. "But their books do. Their books stay."', '"I will tell you something I have told no one." Her voice is very low. "The Archon herself was a hedge-witch once. A girl the Hearthwatch hid from the inquisitors. She was hidden, and now she does the hunting. I do not know what to do with that."', '"Still walking. Still praying. Some days for the Synod, some days for the people it writes down. I hope those are the same prayer. I am no longer sure."', '"You look tired. Sit. Eat. The realm will still be broken in an hour."'],
      react: [{ if: st => C.jobDone(st, 'sealed_letter'), text: '"The Orchard Row clerks said a stranger carried my letter. I did not tell them I knew the stranger. Some things are safer unwritten. You see? I am learning."' }, { if: st => C.jobDone(st, 'hedge_mage'), text: '"I hear the healer has gone from Pale Vigil. I hope she is warm, wherever the road took her. Or wherever the Synod did."' }] },
    hask: { name: 'Corporal Hask', desc: 'a deserter in a coat that used to be a uniform', route: ['ragged_fence', 'gullsong', 'driftmoor_farm', 'hobbs_reach', 'wayfarers_rest'],
      lines: ['"Do not stare. I was a corporal once. Now I am a man who owns a coat, and the coat remembers more than I do."', '"Still alive, still walking. You look like you are on the same schedule." He spits. "They left us in the field, you know. Marrow Ford. The Crown is not a person. It is a debt nobody collects."', '"They keep asking what I know about the Marches. I keep not telling them." He looks at you for a long time. "There is a camp in the old forest, past the Marches. Outlaw\'s Rest. Men like me. If you ever need a friend nobody else will be, tell them Hask sent you."', '"Here is a thing I heard from a steward, drunk, at Wayfarer\'s Rest. The old king never named an heir. Never. And the seal on his Barrow door was set after he was dead, not before." He shrugs. "Means nothing to me. Means a great deal to somebody."', 'He has never told you the rest of it before. "At Marrow Ford the Banner held the rearguard so the army could cross. The Lord Marshal was supposed to send the signal to fall back. He never sent it. Voss. Bertrand Voss. We waited all night. He knew."', '"Do not look at me like that. It was eighteen years ago. The coat still remembers. So do I, on the bad days."', '"Still alive? Good. Somebody ought to be."'],
      react: [{ if: st => C.jobDone(st, 'toll_road'), text: '"You cleared the barn? I knew two of them. Do not tell me their names." He is quiet. "They were good once. Hunger is a bad sergeant."' }, { if: st => !!st.world.flags.marches_lost, text: '"The Marches have fallen and I am not even surprised. The Crown never sends enough. It never has."' }] },
    wen: { name: 'Old Wen', desc: 'a ferrywoman who has seen every river mood', route: ['gilded_ferry', 'barge_landing', 'silt_wharf', 'tollhouse_quay', 'brassbell'],
      lines: ['"If you are going downriver, pay first. If you are going up, pay double. The river does not care which, but I do."', '"Back again. The river knows you now. It is not impressed. Neither am I, but I take your coin the same."', '"Fifty years on the water. I have seen what comes up and I have seen what goes down. Grain goes down to the cities. Debt comes back up. Nobody ever ships it the other way."', '"There are two ledgers in the counting-houses, they say. One for us and one for them. I only ever see the first one. I pay into it every day."', '"Get in, sit down, do not rock the boat. That is the whole of my wisdom, and it has kept me alive."'],
      react: [{ if: st => Object.keys(C.DUNGEONS).some(d => { try { return C.dungeonStatus(st, d).cleared; } catch (e) { return false; } }), text: '"I hear somebody walked out of the old toll cellars with all their limbs. Whoever it was owes me a fare, and I will collect it."' }] },
    dov: { name: 'Dov Quill', desc: 'a thin Syndicate clerk with ink to the elbow', route: ['rivermeet', 'stonebridge', 'canalgate', 'mercers_row', 'low_docks'],
      lines: ['"Account name? No? Then you are an opportunity. Welcome." He writes something down. "Dov Quill. I keep the small books. Small books are where the big ones keep their secrets."', '"I remember a face the way I remember a debt: completely, and with interest."', '"You are on my list. Not the bad one. The other one. The longer one." He taps his nose with an inky finger. "Keep it that way and the Syndicate will be very generous. Stop, and it will still be very generous, to somebody else, with your things."', '"Every ledger in the Syndicate carries a tiny mark in the corner. Every one. The clerks cannot explain it, and the Factors do not try." He wipes his pen. "I have been trying for nine years. I think it is somebody\'s cipher. I think it is somebody who is not on any list at all."', '"Forget I said that. No, really. Forget it. I have a list of people who did not forget things, and it is a short list, and it is getting shorter."', '"Business as usual. Which is to say: everyone owes, and nobody is allowed to know who to."'],
      react: [{ if: st => C.jobDone(st, 'pennant_debt'), text: '"The Pennant Green account is closed. Somebody was very efficient." He looks at you over his spectacles. "Efficient is a compliment. Mostly."' }, { if: st => C.jobDone(st, 'cellar_ledger'), text: '"We found the ledger. Do not ask how. We would rather not say, and you would rather not know."' }] },
    ysolde: { name: 'Ysolde the Hedge-Singer', desc: 'a barefoot singer with a lute missing two strings', route: ['wheatvale', 'applecourt', 'sheepfold', 'millstream', 'duskwater_mill'],
      lines: ['"Free song, paid song, or silence. Silence costs the most, because nobody ever wants to hear it twice."', '"I wrote a verse about your last visit. It rhymes badly. The truth often does."', '"Every road has a song. Yours is just getting started, and I do not know the ending yet. Neither do you. That is the only kind worth singing."', '"I sang about the old king in Wheatvale and three men walked out. I sang about the Interval and the whole room went quiet. Interesting, what people cannot bear to hear."', '"Have a verse, free: \'The throne is empty, the lords are full, the roads are open, the purses are pulled.\' It needs work. So does the realm."'],
      react: [{ if: st => C.jobDone(st, 'barrow_whispers'), text: '"Lights in the Barrow. I have a verse for that. It scares the children, which is its job, and it scares the stewards, which is not."' }] }
  };
  C.npcAt = function (st, id) {
    const day = st.world.day, per = Math.floor(day / 3);
    return Object.entries(C.NPCS).filter(([k, p]) => { const r = p.route.filter(x => C.NODES[x]); return r.length && r[hsh(k + '|' + per) % r.length] === id; }).map(([k, p]) => ({ id: k, name: p.name, desc: p.desc, met: (st.world.npcMet || {})[k] || 0, talkedToday: (st.world.npcTalk || {})[k] === day }));
  };
  C.npcTalk = function (st, id, npcId) {
    const here = C.npcAt(st, id).find(n => n.id === npcId); if (!here) return { ok: false, reason: 'They are not here' }; if (here.talkedToday) return { ok: false, reason: 'You have already spoken today' };
    const p = C.NPCS[npcId], met = (st.world.npcMet = st.world.npcMet || {}), talk = (st.world.npcTalk = st.world.npcTalk || {}), n = met[npcId] || 0;
    const reacts = p.react.filter(r => r.if(st)), line = reacts.length && n > 0 && hsh(npcId + st.world.day) % 2 ? reacts[hsh(npcId + st.world.day + 'r') % reacts.length].text : p.lines[n < p.lines.length ? n : Math.max(0, p.lines.length - 2) + ((n - p.lines.length) % Math.min(2, p.lines.length))];
    met[npcId] = n + 1; talk[npcId] = st.world.day; C.lore(st, 'npc:' + npcId + ':' + (n + 1));
    const out = { ok: true, name: p.name, desc: p.desc, text: line, found: [], gold: 0, first: n === 0 };
    if (n >= 1 && n % 2 === 1) { const rr = tvRumour(st, id, tvRng(npcId + '|' + st.world.day + '|' + n)); if (rr) { out.tip = rr.lines[0].text; out.found = rr.found || []; } }
    if (n >= 3 && n % 3 === 0) { out.gold = 10 + n * 2; st.inventory.gold += out.gold; out.gift = 'They press a few coins into your hand. "For the road."'; }
    return out;
  };
  C.ROAD_SIGHTS = [
    'A burnt-out cart lies in the ditch, its load scattered. Somebody has already picked it over.', 'A funeral procession crosses the road: six bearers, a priest, and one dog that will not leave the coffin.',
    'A patrol drags a hooded prisoner along in the dust. Nobody looks at you.', 'A shrine at a crossroad has fresh flowers and an unlit candle. Someone is hoping.', 'A merchant\'s mule has gone lame and he is sitting on a milestone, arguing with it.',
    'Two children are racing hoops down the hill with a goat chasing them.', 'A long file of pilgrims winds past, singing slightly out of tune.', 'A signpost has been turned round. Someone thought that was funny.',
    'A tinker is mending a pot in the middle of the road and refuses to move for anyone.', 'Wolves have been at a stray lamb. The shepherd is bandaging her own hand.', 'A bard on a gatepost is composing a song about you, apparently. It is mostly rhymes with "ditch".',
    'A scarecrow wears a stolen soldier\'s helm, and somebody has given it a coin purse. You do not touch it.', 'The wind brings the smell of a far-off fire, and then it passes.'
  ];
  C.sight = function (st, from, to) { if (hsh(from + '>' + to + '|' + st.world.day + '|s') % 100 >= 18) return null; return { id: 'sight', text: hpick(C.ROAD_SIGHTS, to + '|' + st.world.day) }; };
  // Each sight leaves something behind: a few coins, a little goodwill, or a road you had not noticed. Sights never stop a journey; the shell lists them on arrival.
  C.SIGHT_GIFTS = [
    ['A burnt-out cart', { gold: 10, note: 'They missed a purse under the axle: +10 gold.' }], ['A funeral procession', { goodwill: 1, note: 'You stand aside, heads bowed. Word of it travels.' }],
    ['A patrol drags', { reveal: 1, note: 'You see which road they came by.' }], ['A shrine at a crossroad', { goodwill: 1, note: 'You light the candle as you pass.' }],
    ['A merchant\'s mule', { gold: 8, note: 'You get the mule moving again. He pays 8 gold for the trouble.' }], ['Two children', { reveal: 1, note: 'They shout a shortcut after you.' }],
    ['A long file of pilgrims', { goodwill: 1, note: 'You walk with them a mile and share your water.' }], ['A signpost has been turned', { reveal: 1, note: 'You turn it back, and read where the roads really go.' }],
    ['A tinker is mending', { gold: 6, note: 'He buys a bent buckle off you for 6 gold. Odd man.' }], ['Wolves have been at', { goodwill: 1, note: 'You bind her hand properly before moving on.' }],
    ['A bard on a gatepost', { gold: 5, note: 'The crowd he has gathered tosses coins. He shares 5 with his subject.' }], ['A scarecrow wears', { goodwill: 1, note: 'A farmer sees you leave the purse alone, and remembers.' }],
    ['The wind brings', { reveal: 1, note: 'You climb a rise to look, and see more of the land.' }]
  ];
  { const sg0 = C.sight; C.sight = function (st, from, to) { const r = sg0.apply(this, arguments); if (!r) return r;
      const g = (C.SIGHT_GIFTS.find(([k]) => r.text.indexOf(k) === 0) || [])[1]; if (!g) { r.note = 'A sign of the times. Worth remembering.'; return r; }
      if (g.gold) st.inventory.gold += g.gold; if (g.goodwill && S().changeGoodwill) S().changeGoodwill(st, g.goodwill, 'kindness on the road');
      const found = [];
      if (g.reveal) { const seen = new Set([to]); let f = [to]; for (let d = 0; d < 2 && found.length < 2; d++) { const nx = []; f.forEach(x => Object.keys(C.NODES[x].links).forEach(y => { if (seen.has(y)) return; seen.add(y); nx.push(y); if (found.length < 2 && !C.isDiscovered(st, y) && !C.NODES[y].hidden) { C.discover(st, y); found.push(y); } })); f = nx; } }   // one or two places, not a whole county r.note = g.note + (g.goodwill ? ' (Hearthwatch goodwill +' + g.goodwill + ')' : '') + (g.reveal ? (found.length ? ' New on your map: ' + found.map(x => C.NODES[x].name).join(', ') + '.' : ' Nothing new, but you know the way better.') : '');
      r.note = g.note + (g.goodwill ? ' (Hearthwatch goodwill +' + g.goodwill + ')' : '') + (g.reveal ? (found.length ? ' New on your map: ' + found.map(x => C.NODES[x].name).join(', ') + '.' : ' Nothing new, but you know the way better.') : '');
      r.gold = g.gold || 0; r.found = found; return r; }; }
  C.LETTER_TEXT = {
    crown: 'The Crown notes your service at {at}. A little coin goes with the sergeant\'s regard.', syndicate: 'Your account at {at} is settled, with a small courtesy added. Do remember who extended it.',
    synod: 'The clerks of {at} remember you in their prayers and in their ledgers. A small offering goes with this note.', general: 'Word got round that you did right by {at}. The folk there chipped in what they could.'
  };
  C.queueLetter = function (st, jobId) {
    const j = C.JOBS[jobId]; if (!j) return; const q = st.world.letters = st.world.letters || [], base = Math.max(5, Math.round(((j.reward || {}).gold || 0) * 0.2));
    q.push({ due: st.world.day + 3, from: j.giver, text: (C.LETTER_TEXT[j.giver] || C.LETTER_TEXT.general).replace('{at}', C.NODES[j.at].name), gold: base });
  };
  C.jobLeads = st => Object.keys(st.world.tvSeen || {}).filter(k => k.startsWith('job_')).map(k => k.slice(4)).filter(k => C.JOBS[k] && !C.jobsOf(st)[k]).map(k => ({ id: k, giver: C.JOBS[k].giver, at: C.JOBS[k].at }));
  C.takeLetters = function (st) { const q = st.world.letters || [], due = q.filter(l => l.due <= st.world.day); if (!due.length) return []; st.world.letters = q.filter(l => l.due > st.world.day); due.forEach(l => { st.inventory.gold += l.gold; }); return due; };

  // ---- the dossier: what the player has learned about each faction, and the secrets they can prove ----
  // Entries appear only once learned (seen, overheard, told or found). Depth gates what a source will say: 0 anyone, 1 friendly or a rank, 2 allied or rank 2 (the leadership's own version).
  // Secrets climb rumour (1) > evidence (2) > proof (3). Not every rumour is true: a rumour can be followed up (visit a place) and turn out false. Holding proof makes the faction send hunters; defend it or lose it.
  C.LORE = {}; const LK = ['ideal', 'strength', 'weakness', 'figure', 'view', 'secret'];
  const L = (id, f, kind, depth, text, o) => { C.LORE[id] = Object.assign({ id, faction: f, kind, depth, text }, o || {}); };
  // --- Royalist Crown ---
  L('c_ideal', 'crown', 'ideal', 0, 'Order, even stiff and unfair, is better than a war over who sits the throne. Ask a sergeant and he will say it in fewer words.');
  L('c_ideal_in', 'crown', 'ideal', 2, 'The lords do not call it order among themselves. They call it the Interval: the quiet before a claimant is named. Nobody is allowed to say how long the Interval has lasted.');
  L('c_strength', 'crown', 'strength', 0, 'A garrison in every shire and roads that work. Where the Crown rules, a cart can cross a county without being robbed.');
  L('c_weak', 'crown', 'weakness', 1, 'The lords hold the realm by oath, not love. Each sits on his own grain and his own levy and would not send either far from home.');
  L('c_fig_sergeant', 'crown', 'figure', 0, 'The sergeant at Rivermeet. Pays for steady swords and thinks the realm is held together by men like him.');
  L('c_fig_steward', 'crown', 'figure', 0, 'The Steward of Crown Keep. Greyer each month since he sent a stranger to the Barrow. Folk say he keeps the old king\'s seal.');
  L('c_view_synd', 'crown', 'view', 0, 'Crown clerks on the Syndicate: "They own half our debt and call it a favour."');
  L('c_view_hask', 'crown', 'view', 1, 'A deserter on the Crown: "They left us in the field. The Crown is not a person. It is a debt nobody collects."');
  L('s_succ_r1', 'crown', 'secret', 0, 'A steward swears the old king never named an heir, and that the seal on his Barrow was set after he died, not before. If so, somebody has been hiding an empty throne.', { sid: 'succession', stage: 1, truth: true, follow: { visit: 'kings_barrow', gives: 's_succ_e' } });
  L('s_succ_r2', 'crown', 'secret', 0, 'They say the old king is not dead at all. He lies in Whitestone Abbey, waiting for the right hour.', { sid: 'succession', stage: 1, truth: false, follow: { visit: 'whitestone_abbey' }, falseText: 'The abbey holds monks and a very old dog. Nobody is waiting for anything.' });
  L('s_succ_e', 'crown', 'secret', 0, 'The seal on the Barrow door is newer than the dust around it. Someone resealed it long after the funeral.', { sid: 'succession', stage: 2, truth: true });
  L('s_succ_p', 'crown', 'secret', 0, 'The Heir\'s Writ: the old king\'s own hand, naming no one. The throne has no rightful claimant, and the lords have known it all through the Interval, and let the realm wait anyway.', { sid: 'succession', stage: 3, truth: true });
  // --- Mercantile Syndicate ---
  L('y_ideal', 'syndicate', 'ideal', 0, 'Whoever owns the debts and the grain owns the realm, and that is safer than a crown.');
  L('y_ideal_in', 'syndicate', 'ideal', 2, 'Among the factors they call it the Long Ledger: a balanced book is the only peace that lasts. They truly do not see the harm in it.');
  L('y_strength', 'syndicate', 'strength', 0, 'Credit, grain barges and fast news. The Syndicate can feed a town or starve one in a week.');
  L('y_weak', 'syndicate', 'weakness', 1, 'Every kindness has a ledger and every ledger has a creditor. Spoil the trust in the books and the whole thing wobbles.');
  L('y_fig_dov', 'syndicate', 'figure', 0, 'Dov Quill, a thin clerk who remembers every face like a debt. Ask about the ledgers and he changes the subject.');
  L('y_fig_factor', 'syndicate', 'figure', 0, 'The factor at Rivermeet. Smiles in a way you do not like.');
  L('y_view_synod', 'syndicate', 'view', 0, 'Synod clerks on the Syndicate: "Charity with a ledger behind it is still charity. But whose?"');
  L('s_hand_r1', 'syndicate', 'secret', 0, 'Every Syndicate ledger carries a tiny mark in the corner that the clerks cannot explain. It looks like a cipher. Nobody has found whose it is, and the Factors do not ask.', { sid: 'hidden_hand', stage: 1, truth: true, follow: { visit: 'ledgerhall', gives: 's_hand_e' } });
  L('s_hand_r2', 'syndicate', 'secret', 0, 'The Syndicate is run by the old Duke of Gildhaven, kept alive by Synod magic.', { sid: 'hidden_hand', stage: 1, truth: false, follow: { visit: 'debtors_tower' }, falseText: 'The Duke died years ago. The tower holds debtors, not masters.' });
  L('s_hand_e', 'syndicate', 'secret', 0, 'A clerk at Ledgerhall copies the same mark on every authorised draft. It is not a name. It is a number, and it changes.', { sid: 'hidden_hand', stage: 2, truth: true });
  L('s_hand_p', 'syndicate', 'secret', 0, 'The Second Book: a hidden ledger of every lord\'s debt that was never written in the first, and the cipher of the one person who holds them all. Whoever holds it holds the lords.', { sid: 'hidden_hand', stage: 3, truth: true });
  // --- Ascendant Synod ---
  L('sy_ideal', 'synod', 'ideal', 0, 'Magic is dangerous and must be policed. The rank and file believe it sincerely, and they have stopped real disasters.');
  L('sy_ideal_in', 'synod', 'ideal', 2, 'The inner circle calls it stewardship: if dangerous knowledge has to be held by someone, better the ones who understand it.');
  L('sy_strength', 'synod', 'strength', 0, 'Wards, hospices and a long memory. The Synod keeps a record of every confession and every spell.');
  L('sy_weak', 'synod', 'weakness', 1, 'They cannot see what is not written down. Hedge-mages outlive the Synod\'s lists.');
  L('sy_fig_maren', 'synod', 'figure', 0, 'Sister Maren, a travelling pilgrim in a patched mantle. She believes, and she is troubled.');
  L('sy_fig_clerk', 'synod', 'figure', 0, 'The clerk at Orchard Row who wrote down every word you said.');
  L('s_hoard_r1', 'synod', 'secret', 0, 'Mages taken "for questioning" to Vol\'Dun are not seen again. Their families are told they were registered and released. The Synod keeps their grimoires.', { sid: 'forbidden_hoard', stage: 1, truth: true, follow: { visit: 'orchard_row', gives: 's_hoard_e' } });
  L('s_hoard_r2', 'synod', 'secret', 0, 'The Synod\'s inner circle died years ago. A necromancer wears their robes and signs their letters.', { sid: 'forbidden_hoard', stage: 1, truth: false, follow: { visit: 'pale_vigil' }, falseText: 'A lame cat and a cold hearth. Nothing sinister, only sad.' });
  L('s_hoard_e', 'synod', 'secret', 0, 'The transfer orders at Orchard Row name no chantry. All are stamped Vol\'Dun with a closed eye, and all are for mages who never arrived.', { sid: 'forbidden_hoard', stage: 2, truth: true });
  L('s_hoard_p', 'synod', 'secret', 0, 'The Sealed Ledger: every grimoire the Synod has taken, and where each one went. None of them were burned. They all went down, under Vol\'Dun.', { sid: 'forbidden_hoard', stage: 3, truth: true });
  // generic views built from the tavern lines: what its friends say, what its critics say
  Object.entries(C.TV_TALK).forEach(([f, t]) => { L('tv_' + f + '_p', f, 'view', 0, 'Its friends say: ' + t[0]); L('tv_' + f + '_s', f, 'view', 0, 'Its critics say: ' + t[1]); });
  C.SECRETS = {
    succession: { faction: 'crown', name: 'The Empty Throne', proof: 's_succ_p', rival: 'syndicate', hunt: 'Crown agents', squad: [[{ primary: 'warrior', name: 'Royal Agent' }, { primary: 'archer', name: 'Crown Marksman' }, { primary: 'rogue', name: 'Sealer' }], [{ primary: 'warlord', name: 'Crown Warden' }, { primary: 'marksman', name: 'Royal Marksman' }, { primary: 'assassin', name: 'Quiet Hand' }]] },
    hidden_hand: { faction: 'syndicate', name: 'The Hidden Hand', proof: 's_hand_p', rival: 'crown', hunt: 'Syndicate collectors', squad: [[{ primary: 'rogue', name: 'Collector' }, { primary: 'warrior', name: 'Ledger Guard' }, { primary: 'archer', name: 'Lookout' }], [{ primary: 'assassin', name: 'Silent Auditor' }, { primary: 'marksman', name: 'Hired Rifle' }, { primary: 'warrior', name: 'Debt Enforcer' }]] },
    forbidden_hoard: { faction: 'synod', name: 'The Forbidden Hoard', proof: 's_hoard_p', rival: 'crown', hunt: 'Synod inquisitors', squad: [[{ primary: 'acolyte', name: 'Chantry Guard' }, { primary: 'apprentice', name: 'Ward-Reader' }, { primary: 'squire', name: 'Lay Brother' }], [{ primary: 'wizard', name: 'Inquisitor' }, { primary: 'cleric', name: 'Confessor' }, { primary: 'warrior', name: 'Chantry Champion' }]] }
  };
  // what you see and do teaches you things (event: job_done:<job>, visit:<place>, squab:<a>|<b>, npc:<id>:<meetings>, dungeon:<id>)
  C.LORE_ON = {
    'job_done:toll_road': ['c_strength', 'c_fig_sergeant'], 'job_done:barrow_whispers': ['c_fig_steward', 'c_weak', 's_succ_r1'],
    'job_done:pennant_debt': ['y_ideal'], 'job_done:cellar_ledger': ['y_fig_factor', 'y_weak', 's_hand_r1'], 'visit:canalgate': ['y_strength'],
    'job_done:sealed_letter': ['sy_ideal'], 'job_done:hedge_mage': ['sy_fig_clerk', 'sy_weak', 's_hoard_r1'], 'visit:orchard_row': ['sy_strength'], 'visit:rivermeet': ['c_ideal'],
    'squab:crown|syndicate': ['c_view_synd'], 'squab:synod|syndicate': ['y_view_synod'],
    'npc:hask:2': ['c_view_hask'], 'npc:hask:4': ['s_succ_r1'], 'npc:dov:1': ['y_fig_dov'], 'npc:dov:4': ['s_hand_r1'], 'npc:maren:1': ['sy_fig_maren'], 'npc:maren:4': ['s_hoard_r1'],
    'dungeon:kings_barrow_depths': ['s_succ_p'], 'dungeon:silt_wharf_undercroft': ['s_hand_p']
  };
  const dos = st => { const w = st.world; if (!w.dossier) w.dossier = { got: {}, secrets: {}, resolved: {}, proof: {}, inf: {}, news: [] }; return w.dossier; };
  C.depthOf = function (st, f) { const tier = S().standingTier(st, f).id, r = S().getRank ? S().getRank(st, f) : null; let d = 0; if (tier === 'friendly' || (r && r.rank >= 1)) d = 1; if (tier === 'allied' || (r && r.rank >= 2)) d = 2; return d; };
  C.knows = (st, id) => !!dos(st).got[id];
  C.learn = function (st, id, src) {
    const e = C.LORE[id], d = dos(st); if (!e) return { ok: false, reason: 'unknown' }; if (d.got[id]) return { ok: false, reason: 'known' };
    if (e.depth > C.depthOf(st, e.faction)) return { ok: false, reason: 'depth' };
    d.got[id] = { day: st.world.day, src: src || 'Heard' }; d.news.push({ id, kind: 'new' });
    if (e.sid) { d.secrets[e.sid] = Math.max(d.secrets[e.sid] || 0, e.stage); if (e.stage === 3 && !d.proof[e.sid]) d.proof[e.sid] = { since: st.world.day, defended: 0, held: true }; }
    return { ok: true, entry: e };
  };
  const srcOf = ev => { const [k, a, b] = ev.split(':'); const nm = x => (C.NODES[x] ? C.NODES[x].name : x); return k === 'job_done' ? 'Seen while working' : k === 'visit' ? 'Seen at ' + nm(a) : k === 'squab' ? 'Overheard in a tavern' : k === 'npc' ? 'Told by ' + (C.NPCS[a] ? C.NPCS[a].name : a) : k === 'dungeon' ? 'Found in ' + (C.DUNGEONS[a] ? C.DUNGEONS[a].name : a) : 'Heard'; };
  C.lore = function (st, ev) {
    const d = dos(st); (C.LORE_ON[ev] || []).forEach(id => C.learn(st, id, srcOf(ev)));
    if (ev.startsWith('visit:')) { const at = ev.slice(6), name = C.NODES[at] ? C.NODES[at].name : at; // follow-ups: a visit settles the rumours that pointed here
      Object.keys(d.got).forEach(id => { const e = C.LORE[id]; if (!e || !e.follow || e.follow.visit !== at || d.resolved[id]) return;
        if (e.truth) { d.resolved[id] = 'true'; if (e.follow.gives) C.learn(st, e.follow.gives, 'Checked at ' + name); } else { d.resolved[id] = 'false'; d.news.push({ id, kind: 'false' }); } }); }
  };
  C.rumourState = function (st, id) { const e = C.LORE[id], d = dos(st); if (!e || e.kind !== 'secret' || e.stage !== 1) return null; if (d.resolved[id] === 'false') return 'false'; if (e.truth && (d.secrets[e.sid] || 0) >= 2) return 'confirmed'; return d.resolved[id] === 'true' ? 'confirmed' : 'unverified'; };
  C.dossier = function (st, f) {
    const d = dos(st); return Object.keys(d.got).map(id => C.LORE[id]).filter(e => e && e.faction === f).sort((a, b) => LK.indexOf(a.kind) - LK.indexOf(b.kind) || d.got[a.id].day - d.got[b.id].day)
      .map(e => ({ id: e.id, kind: e.kind, depth: e.depth, text: e.text, src: d.got[e.id].src, day: d.got[e.id].day, stage: e.stage || 0, state: C.rumourState(st, e.id), falseText: e.falseText || null }));
  };
  C.dossierCount = (st, f) => Object.keys(dos(st).got).filter(id => C.LORE[id] && C.LORE[id].faction === f).length;
  C.takeLoreNews = function (st) { const d = dos(st), n = d.news; d.news = []; return n.map(x => { const e = C.LORE[x.id]; return x.kind === 'false' ? { kind: 'false', faction: e.faction, text: 'A rumour about ' + C.tvName(e.faction) + ' turns out to be false.' } : { kind: 'new', faction: e.faction, text: 'Dossier: ' + C.tvName(e.faction).replace(/^the /, '') + ' (' + e.kind + ')' }; }); };
  C.loreSweep = function (st) { Object.keys(C.LORE).forEach(id => { const e = C.LORE[id]; if (e.depth === 2 && !C.knows(st, id) && C.depthOf(st, e.faction) >= 2) C.learn(st, id, 'Said among the leadership'); }); };
  // whispers in the tavern: some are true, some are not
  function tvWhisper(st, id, r) {
    const d = dos(st), pool = Object.values(C.LORE).filter(e => e.kind === 'secret' && e.stage === 1 && !d.got[e.id]); if (!pool.length) return null;
    const e = tvPick(r, pool), who = tvPick(r, (C.TV_PEOPLE[C.NODES[id].region] || []).concat(C.TV_PEOPLE.any)); C.learn(st, e.id, 'Whispered in a tavern');
    return { kind: 'whisper', title: 'A whisper', lines: [{ who: who + ', leaning in', text: e.text }], narr: tvPick(r, ['They look over their shoulder before they finish. You cannot tell whether they believe it themselves.', 'They say it low and quick, and are gone before you can ask where they heard it.', 'It may be true. It may be a story told for a free drink. Only checking will tell.']), fac: e.faction };
  }
  // whistleblowers: someone inside, unhappy, who will talk if you have already heard the rumour
  C.INFORMANTS = {
    pell: { name: 'Quartermaster Pell', desc: 'a Crown quartermaster with a nervous cough', faction: 'crown', sid: 'succession', at: 'crownwatch_inn', evidence: 's_succ_e', proof: 's_succ_p', first: '"I count the king\'s stores. All of them, even the ones he never ate. Twelve years of an empty throne, and the stores still come in under his name." He coughs. "I know what the Barrow door really says. Will you hear it? Not here. Not loud."', second: '"I took this from the sealed chest before the steward noticed. If I am found with it I am done. Take it and go far."' },
    iris: { name: 'Iris Vane', desc: 'a Syndicate junior clerk with ink on her cuffs', faction: 'syndicate', sid: 'hidden_hand', at: 'canalgate', evidence: 's_hand_e', proof: 's_hand_p', first: '"The mark on every draft is a number. A tiny one, in the corner, in the same hand. I have watched it change for six years." She turns her cuff so the ink does not show. "Nobody asks whose it is. I asked once. I was given a raise and a new desk, a long way from the books."', second: '"The Second Book. I copied the first page and nothing else. Take it before they count the ledgers."' },
    aldric: { name: 'Novice Aldric', desc: 'a pale Synod novice with chantry-cropped hair', faction: 'synod', sid: 'forbidden_hoard', at: 'orchard_row', evidence: 's_hoard_e', proof: 's_hoard_p', first: '"I fetch the transfer orders for prisoners sent on to Vol\'Dun. There are no chantries on them, no names of who received them. They just go down." He swallows. "Do you know what that means? Neither do I. I would like to stop wondering."', second: '"I have the ledger. I cannot carry it any longer. If the inquisitors find it, they will not ask whose it was."' }
  };
  C.informantAt = function (st, id) {
    const d = dos(st); return Object.entries(C.INFORMANTS).filter(([k, p]) => p.at === id && (d.secrets[p.sid] || 0) >= 1 && S().standingTier(st, p.faction).id !== 'hostile' && !(d.inf[k] && d.inf[k].done))
      .map(([k, p]) => { const s = d.inf[k] || { stage: 0 }, wait = s.stage === 1 && st.world.day - s.day < 3; return { id: k, name: p.name, desc: p.desc, faction: p.faction, stage: s.stage, wait, line: s.stage ? p.second : p.first, canProof: s.stage === 1 && !wait && !d.got[p.proof] }; });
  };
  C.informantAct = function (st, id, k, how) {
    const p = C.INFORMANTS[k], d = dos(st), a = C.informantAt(st, id).find(x => x.id === k); if (!a) return { ok: false, reason: 'They are not here' }; const s = d.inf[k] = d.inf[k] || { stage: 0, day: st.world.day };
    if (how === 'report') { const ch = S().changeStanding(st, p.faction, 30, { reason: 'reported a leak' }); s.done = true; return { ok: true, text: 'You pass the name up the line. They thank you in the way institutions do. Pell, Iris and Aldric are not the sort to be seen again.'.replace('Pell, Iris and Aldric are', p.name + ' is'), changes: ch }; }
    if (how === 'listen' && s.stage === 0) { const r = C.learn(st, p.evidence, 'Told by ' + p.name); s.stage = 1; s.day = st.world.day; return { ok: true, text: C.LORE[p.evidence].text, learned: r.ok }; }
    if (how === 'take' && s.stage === 1) { if (a.wait) return { ok: false, reason: p.name + ' needs a few days to get it out' }; const ch = S().changeStanding(st, p.faction, -20, { reason: 'took stolen proof' }); const r = C.learn(st, p.proof, 'Given by ' + p.name); s.done = true; return { ok: true, text: C.LORE[p.proof].text, learned: r.ok, changes: ch, proof: true }; }
    return { ok: false, reason: 'Nothing to do' };
  };
  // proof: held proof draws hunters (after word gets out), must be defended, and can be used
  C.proofs = st => { const d = dos(st); return Object.entries(d.proof).filter(([k, p]) => p.held).map(([k, p]) => Object.assign({ sid: k, name: C.LORE[C.SECRETS[k].proof].text.split(':')[0], secret: C.SECRETS[k].name, faction: C.SECRETS[k].faction }, p, { hunted: st.world.day - p.since >= 4 })); };
  C.PROOF = { lag: 4, base: 0.1, perDefence: 0.04, cap: 0.35 };
  C.proofHunt = function (st, region, from, to, days) {
    const list = C.proofs(st).filter(p => st.world.day - p.since >= C.PROOF.lag); if (!list.length) return null;
    for (let i = 0; i < days; i++) for (const p of list) if (rnd(st) < Math.min(C.PROOF.cap, C.PROOF.base + C.PROOF.perDefence * p.defended)) {
      const S0 = C.SECRETS[p.sid], lv = partyLevel(st), set = S0.squad[lv > 7 ? 1 : 0], enc = { name: 'Ambush: ' + S0.hunt, map: C.mapFor(st, region, to), rec: lv, enemyFaction: S0.faction, enemies: set.map(e => Object.assign({}, e)), objective: null, once: false, wander: true, proofFor: p.sid, reward: { xp: 70 + 12 * lv, gold: 20 + 6 * lv } };
      return setWander(st, { kind: 'fight', region, from, to, day: st.world.day, enc, text: C.tvName(S0.faction).replace(/^the /, 'The ') + ' know what you carry. ' + S0.hunt + ' have found you, and they want ' + p.name.toLowerCase().replace(/^the /, 'the ') + ' back.' });
    }
    return null;
  };
  C.proofResult = function (st, sid, won) { const d = dos(st), p = d.proof[sid]; if (!p || !p.held) return null; if (won) { p.defended++; return { kept: true, text: 'You drive them off. The proof is still yours, and they will be back.' }; } p.held = false; p.lost = true; return { kept: false, text: 'They take the proof. ' + C.SECRETS[sid].name + ' goes back into the dark.' }; };
  C.proofActions = function (st, sid) {
    const d = dos(st), p = d.proof[sid]; if (!p || !p.held) return []; const S0 = C.SECRETS[sid], here = C.ownerOf(st, st.world.location), out = [];
    const rival = here && here !== S0.faction && window.GAME_DATA.factions[here] && S().getRelation(st, here, S0.faction) < 0 && here !== 'outlaws';
    out.push({ id: 'expose', label: 'Expose it to ' + (rival ? C.tvName(here) : 'a rival'), ok: !!rival, why: 'Take it to a place held by a rival of ' + C.tvName(S0.faction) + '.', rival: rival ? here : null });
    out.push({ id: 'blackmail', label: 'Blackmail ' + C.tvName(S0.faction), ok: here === S0.faction && S().standingTier(st, S0.faction).id !== 'hostile', why: 'Do it in a place they hold, where they can reach you.' });
    out.push({ id: 'destroy', label: 'Burn it', ok: true });
    return out;
  };
  C.useProof = function (st, sid, how) {
    const d = dos(st), p = d.proof[sid], S0 = C.SECRETS[sid], opt = C.proofActions(st, sid).find(o => o.id === how); if (!p || !p.held || !opt || !opt.ok) return { ok: false, reason: 'You cannot do that here' };
    const ch = []; let text = '', gold = 0;
    if (how === 'expose') { ch.push(...S().changeStanding(st, opt.rival, 40, { reason: 'proof against ' + S0.name })); ch.push(...S().changeStanding(st, S0.faction, -80, { reason: 'secret exposed', ripple: false })); gold = 80; st.inventory.gold += gold; S().shiftRelation(st, opt.rival, S0.faction, -0.1, { both: true }); st.world.flags['exposed_' + sid] = true; p.held = false; p.used = 'expose'; addBounty(st, S0.faction); text = C.tvName(opt.rival).replace(/^the /, 'The ') + ' read it twice and say nothing. By the next market day, everyone is saying something. ' + C.tvName(S0.faction).replace(/^the /, 'The ') + ' want you silenced.'; }
    else if (how === 'blackmail') { gold = 150 + 20 * partyLevel(st); st.inventory.gold += gold; ch.push(...S().changeStanding(st, S0.faction, -30, { reason: 'blackmail', ripple: false })); p.blackmail = (p.blackmail || 0) + 1; text = 'They pay, with the look of people who plan to remember it. They know you still have it.'; }
    else { p.held = false; p.used = 'destroy'; text = 'It burns quickly. The hunters will find nothing, and so will you.'; }
    return { ok: true, text, changes: ch, gold, how };
  };

  // ---- map and travel ----
  C.neighbors = (st, id) => Object.entries((C.NODES[id] || { links: {} }).links).map(([to, days]) => ({ id: to, days, discovered: C.isDiscovered(st, to) }));
  C.travelCost = (a, b) => (C.NODES[a] && C.NODES[a].links[b]) || null;
  // ---- random encounters on the road ----
  // One roll per day on the road: base + danger of the region, more the longer it has been quiet. Tunable.
  // Random meetings: ordinary roads are nearly quiet (base). Arriving in a zone rolls zoneBase (25%) + perDanger x the zone's danger. In a region whose owner is Hostile to you the roads are hunted (huntBase and up, growing with each patrol, forgotten after huntForget quiet days); border road stops become checkpoints. After bountyAt patrols the faction puts a bounty on you and hunters can find you anywhere (bountyBase per bounty) until it lapses (bountyDecay days) or is settled.
  C.WANDER = { base: 0.02, zoneBase: 0.25, perDanger: 0.07, calmBonus: 0.02, cooldown: 1, cap: 0.5, weights: { fight: 45, trader: 15, event: 25, patrol: 15 }, fleeGoldFraction: 0.1, fleeDays: 1,
    huntBase: 0.2, huntStep: 0.08, huntCap: 0.55, huntForget: 6, bountyAt: 3, bountyBase: 0.12, bountyCap: 0.3, bountyDecay: 20, checkpointDays: 5, tollBase: 20, tollPerLevel: 10, settleBase: 100, settlePerLevel: 30, penanceDays: 5 };
  function rnd(st) { // small seeded generator kept in the save, so reloading a save gives the same road
    let t = st.world.rng; if (!(t >= 0)) t = (Math.random() * 4294967296) >>> 0;
    t = (t + 0x6D2B79F5) >>> 0; st.world.rng = t; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (st, arr) => arr[Math.floor(rnd(st) * arr.length)];
  const nodeDanger = id => Math.max((C.REGIONS[C.NODES[id].region] || {}).danger || 0, C.NODES[id].danger || 0); // a named wild area can be nastier than its region
  const dangerOf = (a, b) => Math.max(nodeDanger(a), nodeDanger(b));
  C.routeRisk = function (path, from) {
    let a = from, d = 0, n = 0; path.forEach(b => { d += dangerOf(a, b) * C.travelCost(a, b); n += C.travelCost(a, b); a = b; });
    const avg = n ? d / n : 0; return avg < 1.2 ? 'low' : avg < 2.2 ? 'medium' : 'high';
  };
  const partyLevel = st => { const l = st.party.map(id => (st.roster.find(u => u.id === id) || {}).level || 1); return Math.max(1, Math.round(l.reduce((x, y) => x + y, 0) / Math.max(1, l.length))); };
  // A generated fight, in the same shape as a story encounter. Rewards scale with level and are lower than a story fight.
  // Which battle map a meeting uses: a zone has its own map (same key as the zone); anywhere else draws from the terrain pool for that region.
  C.REGION_POOL = { crownlands: 'plains', free_marches: 'plains', river_cities: 'riverbank', voldun: 'ruins', elven_realms: 'forest', dwarven_holds: 'highland', iceflow: 'snow', orc_lands: 'volcanic', goblin_fens: 'marsh' };
  C.mapFor = function (st, region, to) {
    const M = G().maps; if (to && C.NODES[to] && C.NODES[to].type === 'zone' && M[to]) return to;
    const tag = C.REGION_POOL[region], list = Object.keys(M).filter(k => M[k].pool === tag);
    return list.length ? pick(st, list) : Object.keys(M)[0];
  };
  function wanderFight(st, region, kind, opts) {
    opts = opts || {}; const lv = Math.max(1, partyLevel(st) + Math.floor(rnd(st) * 3) - 1);
    let name, faction, enemies;
    if (kind === 'patrol') { const p = C.PATROLS[opts.faction]; name = p.name; faction = opts.faction; enemies = p.enemies; }
    else if (kind === 'hunters') { name = opts.set.name; faction = 'outlaws'; enemies = opts.set.enemies; }
    else { const fitM = C.MONSTER_SETS.filter(x => lv >= x.minLv && lv <= x.maxLv && (x.zones || []).includes(opts.to)), zoneM = fitM.length && rnd(st) < 0.6, roam = !fitM.length && lv >= 3 && rnd(st) < 0.05;
      const fit = zoneM ? fitM : C.FOE_SETS.filter(x => lv >= x.minLv && lv <= x.maxLv && (!x.regions || x.regions.includes(region))); const set = pick(st, roam ? C.MONSTER_SETS.filter(x => lv >= x.minLv && lv <= x.maxLv) : fit.length ? fit : C.FOE_SETS.slice(0, 1)); name = set.name; faction = set.faction; enemies = set.enemies; }
    const roll = rnd(st), objective = roll < 0.25 ? { type: 'survive', turns: 4 } : roll < 0.5 ? { type: 'leader', leader: 0 } : null;
    return { name: 'Ambush: ' + name, map: C.mapFor(st, region, opts.to), rec: lv, enemyFaction: faction, enemies: enemies.map(e => Object.assign({}, e)), objective, once: false, wander: true, swap: rnd(st) < 0.5,
      reward: { xp: Math.round((40 + 14 * lv) * 0.6), gold: 12 + 5 * lv + Math.floor(rnd(st) * 10) } };
  }
  function makeTrader(st) {
    const ids = Object.keys(G().gear).filter(g => G().gear[g].price && G().gear[g].price <= 200 && !(G().gear[g].tier > 1) && !G().gear[g].token); let stock = [];   // tier 1 ids, raised to the party's band below
    while (stock.length < 4 && ids.length) stock.push(ids.splice(Math.floor(rnd(st) * ids.length), 1)[0]);
    if (C.promoteStock && C.shopTier) stock = C.promoteStock(stock, Math.max(1, Math.min(7, G().gearTiers.tierForLevel(partyLevel(st)))), 'trader|' + st.world.day);
    return { stock, mult: 0.9 };
  }
  function pickRoadEvent(st, region) {
    const ok = Object.entries(C.CHOICES).filter(([id, c]) => c.road && (!c.regions || c.regions.includes(region)) && !(c.once && st.world.flags['choice_' + id]) && id !== st.world.lastRoadEvent).map(([id]) => id);
    return ok.length ? pick(st, ok) : null;
  }
  // ---- hunted land, checkpoints, bounties ----
  const hostileFac = (st, region) => { const f = (C.REGIONS[region] || {}).faction; return f && C.PATROLS[f] && S().standingTier(st, f).id === 'hostile' ? f : null; };
  function huntState(st, f) { const h = st.world.hunt || (st.world.hunt = {}); let x = h[f] || (h[f] = { n: 0, day: st.world.day }); if (x.n && st.world.day - x.day > C.WANDER.huntForget) { x.n = 0; } return x; }
  function bountyMap(st) {                                   // the exposure scene leaves flags['bounty_<faction>'] = day; fold those in, and let old bounties lapse
    const w = st.world, b = w.bounty || (w.bounty = {});
    for (const k of Object.keys(w.flags || {})) { const m = /^bounty_(.+)$/.exec(k); if (m && typeof w.flags[k] === 'number') { if (!b[m[1]]) b[m[1]] = { since: w.flags[k], last: w.flags[k] }; delete w.flags[k]; } }
    for (const f of Object.keys(b)) if (st.world.day - b[f].last >= C.WANDER.bountyDecay) delete b[f];
    return b;
  }
  C.bounties = st => Object.entries(bountyMap(st)).map(([f, x]) => ({ faction: f, since: x.since, daysLeft: Math.max(0, C.WANDER.bountyDecay - (st.world.day - x.last)), cost: settleCost(st, f) }));
  const settleCost = st => Math.round((C.WANDER.settleBase + C.WANDER.settlePerLevel * partyLevel(st)) * (C.costMult ? C.costMult(st) : 1));
  function addBounty(st, f) { const b = bountyMap(st); if (!b[f]) b[f] = { since: st.world.day, last: st.world.day }; else b[f].last = st.world.day; }
  C.HUNTERS = [
    { maxLv: 6, name: 'Bounty hunters', enemies: [{ primary: 'rogue', name: 'Bounty Hunter' }, { primary: 'archer', name: 'Hunter\'s Bowman' }, { primary: 'squire', name: 'Hired Blade' }] },
    { maxLv: 999, name: 'Bounty hunters', enemies: [{ primary: 'assassin', name: 'Bounty Killer' }, { primary: 'marksman', name: 'Dead-Eye' }, { primary: 'warrior', name: 'Thief-Taker' }] }
  ];
  function patrolFight(st, fac, region, from, to) {
    const enc = wanderFight(st, region, 'patrol', { faction: fac, to }); enc.name = 'Patrol: ' + C.PATROLS[fac].name;
    const hs = huntState(st, fac); hs.n++; hs.day = st.world.day; if (hs.n >= C.WANDER.bountyAt) addBounty(st, fac);
    const nm = C.PATROLS[fac].name.toLowerCase();
    return setWander(st, { kind: 'fight', region, from, to, day: st.world.day, enc, faction: fac, hunted: hs.n, text: hs.n <= 1 ? 'A ' + nm + ' has recognised you and will not let you pass.' : 'The ' + nm + ' are still hunting you. Another band has found you.' });
  }
  function hunterFight(st, region, from, to) {
    const lv = partyLevel(st), set = C.HUNTERS.find(x => lv <= x.maxLv), enc = wanderFight(st, region, 'hunters', { set, to });
    return setWander(st, { kind: 'fight', region, from, to, day: st.world.day, enc, text: 'Someone has been paid to find you. They have.' });
  }
  // Chance (0..1) that arriving in this place starts a meeting, for the map and the node sheet.
  C.zoneChance = function (id) { const n = C.NODES[id], W = C.WANDER; return n && n.type === 'zone' && n.danger > 0 ? Math.min(W.cap, W.zoneBase + W.perDanger * nodeDanger(id)) : 0; };
  C.rollWander = function (st, from, to, days) {
    const W = C.WANDER, n = C.NODES[to], region = n.region, calm0 = st.world.calm || 0; let calm = calm0;
    const hostile = hostileFac(st, region), bm = bountyMap(st), nb = Object.keys(bm).length;
    // checkpoint: a border road stop in hostile land, at most once per few days
    if (hostile && n.type === 'road' && W.checkpointDays && (C.NODES[from] || {}).region !== region) {   // only when entering the land: leaving it, or moving inside it, never stops you
      const pass = (st.world.pass || {})[hostile]; if (pass === undefined || st.world.day - pass > W.checkpointDays) {
        const toll = Math.round((W.tollBase + W.tollPerLevel * partyLevel(st)) * (C.costMult ? C.costMult(st) : 1));
        return setWander(st, { kind: 'checkpoint', region, from, to, day: st.world.day, faction: hostile, toll, text: 'A ' + C.PATROLS[hostile].name.toLowerCase() + ' holds the road. They know your face.' });
      }
    }
    // guided first week: the first zone you walk into while you still have no fight to your name always turns up one (a fair, small one)
    { const f = st.world.flags; if (f.opening && !f.guide_none && !f.guide_off && !f.guide_done && !f.g_fight && n.type === 'zone' && n.danger > 0) { st.world.calm = 0; const enc = wanderFight(st, region, 'fight', { to }); return setWander(st, { kind: 'fight', region, from, to, day: st.world.day, enc, text: 'Armed strangers step out of the grass ahead. Your first real test.' }); } }
    { const ph = C.proofHunt(st, region, from, to, days); if (ph) { st.world.calm = 0; return ph; } }
    for (let d = 1; d <= days; d++) {
      if (nb && W.bountyBase && rnd(st) < Math.min(W.bountyCap, W.bountyBase * nb)) { st.world.calm = 0; return hunterFight(st, region, from, to); }
      if (hostile && W.huntBase) { const hs = huntState(st, hostile); if (rnd(st) < Math.min(W.huntCap, W.huntBase + W.huntStep * hs.n)) { st.world.calm = 0; return patrolFight(st, hostile, region, from, to); } continue; }
      if (calm < W.cooldown) { calm++; continue; }
      const zone = n.type === 'zone' && n.danger > 0, p = zone ? Math.min(W.cap, W.zoneBase + W.perDanger * nodeDanger(to) + W.calmBonus * (calm - W.cooldown)) : W.base;
      if (!(p > 0) || rnd(st) >= p) { calm++; continue; }
      st.world.calm = 0; return makeWander(st, region, from, to);
    }
    st.world.calm = calm; return null;
  };
  // Checkpoint choices: pay the toll, bluff (needs a rank to flash), fight, or turn back.
  C.checkpointOptions = function (st, w) {
    const ranks = S().listRanks ? S().listRanks(st).length : 0;
    return [{ id: 'pay', label: 'Pay the toll (' + w.toll + ' g)', ok: st.inventory.gold >= w.toll }, { id: 'bluff', label: 'Bluff your way through', ok: ranks > 0, note: ranks ? null : 'You have no rank to flash.' },
      { id: 'fight', label: 'Fight your way through', ok: true }, { id: 'turn', label: 'Turn back', ok: true }];
  };
  C.resolveCheckpoint = function (st, choice, roll) {
    const w = st.world.wander; if (!w || w.kind !== 'checkpoint') return { ok: false, reason: 'No checkpoint' };
    const opt = C.checkpointOptions(st, w).find(o => o.id === choice); if (!opt || !opt.ok) return { ok: false, reason: 'Not possible' };
    const pass = () => { (st.world.pass = st.world.pass || {})[w.faction] = st.world.day; st.world.wander = null; };
    if (choice === 'pay') { st.inventory.gold -= w.toll; pass(); return { ok: true, passed: true }; }
    if (choice === 'turn') { const from = w.from; C.turnBack(st, from); return { ok: true, turned: true }; }
    if (choice === 'bluff') { const chance = Math.min(0.8, 0.3 + 0.12 * S().listRanks(st).length + 0.05 * S().listRanks(st).reduce((a, r) => a + (r.trust || 0), 0)); if ((roll === undefined ? rnd(st) : roll) < chance) { pass(); return { ok: true, passed: true, bluffed: true }; } }
    patrolFight(st, w.faction, w.region, w.from, w.to); return { ok: true, fight: true, bluffFailed: choice === 'bluff' };
  };
  // Settling a bounty: the Syndicate will arrange it for a price at any of its places; a Hearthwatch chapel takes penance instead (days of service).
  C.bountyOptions = function (st, id) {
    const n = C.NODES[id], owner = C.ownerOf(st, id), out = [], bs = C.bounties(st); if (!bs.length) return out;
    for (const b of bs) {
      if (owner === 'syndicate' && n.shop) out.push({ faction: b.faction, how: 'pay', cost: Math.round(b.cost * 1.5), ok: st.inventory.gold >= Math.round(b.cost * 1.5) });
      if (owner === 'hearthwatch') out.push({ faction: b.faction, how: 'penance', days: C.WANDER.penanceDays, ok: true });
    }
    return out;
  };
  C.settleBounty = function (st, id, faction, how) {
    const o = C.bountyOptions(st, id).find(x => x.faction === faction && x.how === how); if (!o) return { ok: false, reason: 'Not available here' }; if (!o.ok) return { ok: false, reason: 'Not enough gold' };
    if (how === 'pay') st.inventory.gold -= o.cost; else { S().advanceDay(st, o.days); if (S().changeGoodwill) S().changeGoodwill(st, 3, 'did penance'); }
    delete bountyMap(st)[faction]; huntState(st, faction).n = 0; return { ok: true, how, cost: o.cost || 0, days: o.days || 0 };
  };

  // ---- dungeon state ----
  function dgState(st, id) { const d = st.world.dungeons || (st.world.dungeons = {}); return d[id] || (d[id] = { stage: 0, cleared: false, clearedDay: -1, clears: 0 }); }
  C.refreshDungeon = function (st, id) { const d = C.DUNGEONS[id], s = dgState(st, id); if (d && s.cleared && d.respawn && st.world.day - s.clearedDay >= d.respawn) { s.cleared = false; s.stage = 0; s.refills = (s.refills || 0) + 1; } return s; };
  C.dungeonStatus = function (st, id) {
    const d = C.DUNGEONS[id]; if (!d) return null; const s = C.refreshDungeon(st, id), lv = partyLevel(st), over = lv - d.rec;
    return { id, name: d.name, tier: d.tier, rec: d.rec, floors: d.floors.length, stage: s.stage, cleared: s.cleared, clears: s.clears, respawn: d.respawn || null, why: d.why,
      daysLeft: s.cleared && d.respawn ? Math.max(0, d.respawn - (st.world.day - s.clearedDay)) : null, repeat: s.clears > 0, partyLevel: lv, tooEasy: over > 3, floorName: d.floors[Math.min(s.stage, d.floors.length - 1)].name };
  };
  // Prepare the next floor's fight (rewards depend on the run: repeat clears pay half, and far-above-level parties get less) and return its encounter id, or null when the dungeon is clear.
  C.dungeonFight = function (st, id) {
    const d = C.DUNGEONS[id], s = C.refreshDungeon(st, id); if (!d || s.cleared) return null; const encId = 'dg_' + id + '_' + (s.stage + 1), e = C.ENCOUNTERS[encId];
    const over = partyLevel(st) - d.rec, lvMult = over <= 3 ? 1 : over <= 6 ? 0.6 : 0.3, mult = (s.clears > 0 ? 0.5 : 1) * lvMult, last = s.stage === d.floors.length - 1, first = s.clears === 0 && last;
    e.reward = { xp: Math.round(e.baseReward.xp * mult), gold: Math.round(e.baseReward.gold * mult) + (first && d.first ? d.first.gold : 0) }; if (first && d.first && d.first.items) e.reward.items = Object.assign({}, d.first.items);
    return encId;
  };
  C.reveal = function (st, id) { const n = C.NODES[id]; if (!n || !n.hidden) return { ok: false }; if (st.world.flags['reveal_' + id]) return { ok: false, already: true }; st.world.flags['reveal_' + id] = true; nodeState(st, id).discovered = true; return { ok: true, name: n.name }; };
  function autoReveal(st, at) {
    const out = []; for (const [id, d] of Object.entries(C.DUNGEONS)) if (d.hidden && d.parent === at && d.reveal && d.reveal.auto && partyLevel(st) >= (d.reveal.minLevel || 1) && !st.world.flags['reveal_' + id]) { C.reveal(st, id); out.push(d.name); }
    return out;
  }

  function makeWander(st, region, from, to) {
    const W = C.WANDER, fac = (C.REGIONS[region] || {}).faction; let kinds = Object.entries(W.weights).filter(([k]) => k !== 'patrol' || (fac && C.PATROLS[fac]));
    let total = kinds.reduce((a, [, w]) => a + w, 0), r = rnd(st) * total, kind = kinds[kinds.length - 1][0];
    for (const [k, w] of kinds) { if (r < w) { kind = k; break; } r -= w; }
    const base = { kind, region, from, to, day: st.world.day };
    if (kind === 'patrol') {
      const tier = S().standingTier(st, fac).id;
      if (tier === 'hostile') { const enc = wanderFight(st, region, 'patrol', { faction: fac, to }); enc.name = 'Patrol: ' + C.PATROLS[fac].name; return setWander(st, Object.assign(base, { kind: 'fight', enc, faction: fac, text: 'A ' + C.PATROLS[fac].name.toLowerCase() + ' has recognised you and will not let you pass.' })); }
      if (tier === 'friendly' || tier === 'allied') return setWander(st, Object.assign(base, { kind: 'gift', faction: fac, gold: 20 + 8 * partyLevel(st), tip: true, text: 'A ' + C.PATROLS[fac].name.toLowerCase() + ' greets you by name. They share what they know of the roads and press a few coins on you.' }));
      kind = 'event'; base.kind = 'event';
    }
    if (kind === 'fight') { const enc = wanderFight(st, region, 'fight', { to }); return setWander(st, Object.assign(base, { enc, text: 'Armed strangers step onto the road ahead.' })); }
    if (kind === 'trader') return setWander(st, Object.assign(base, { trader: makeTrader(st), text: 'A wandering trader has pulled his cart off the road and is open for business.' }));
    const ev = pickRoadEvent(st, region);
    if (!ev) { const enc = wanderFight(st, region, 'fight', { to }); return setWander(st, Object.assign(base, { kind: 'fight', enc, text: 'Armed strangers step onto the road ahead.' })); }
    return setWander(st, Object.assign(base, { kind: 'event', choice: ev }));
  }
  function setWander(st, w) { st.world.wander = w; if (w.enc) C.ENCOUNTERS.wander = w.enc; return w; }
  C.activeWander = st => { const w = st.world.wander || null; if (w && w.enc) C.ENCOUNTERS.wander = w.enc; return w; };
  C.endWander = st => { st.world.wander = null; };
  // Run from a road fight: it costs time and a little gold, and you go on.
  C.flee = function (st) {
    const W = C.WANDER, lost = Math.min(st.inventory.gold, Math.max(st.inventory.gold ? 5 : 0, Math.round(st.inventory.gold * W.fleeGoldFraction)));
    const wv = st.world.wander, proof = wv && wv.enc && wv.enc.proofFor ? C.proofResult(st, wv.enc.proofFor, false) : null;
    st.inventory.gold -= lost; S().advanceDay(st, W.fleeDays); st.world.wander = null; return { ok: true, gold: lost, days: W.fleeDays, events: C.runEvents(st), proof };
  };
  // After losing a road fight the party wakes where it set out from.
  C.turnBack = function (st, from) { st.world.location = from; st.world.wander = null; };
  C.claimGift = function (st) { const w = st.world.wander; if (!w || w.kind !== 'gift') return { ok: false }; st.inventory.gold += w.gold; if (w.faction) S().changeStanding(st, w.faction, 5, { reason: 'friendly patrol' }); const found = w.tip ? C.revealAround(st, st.world.location, 2) : []; st.world.wander = null; return { ok: true, gold: w.gold, found }; };
  C.revealAround = function (st, id, depth) { const seen = new Set([id]); let f = [id], out = []; for (let d = 0; d < depth; d++) { const nx = []; f.forEach(x => Object.keys(C.NODES[x].links).forEach(y => { if (!seen.has(y)) { seen.add(y); nx.push(y); if (!C.isDiscovered(st, y)) { C.discover(st, y); out.push(y); } } })); f = nx; } return out; };
  C.traderBuy = function (st, itemId) { const t = st.world.wander && st.world.wander.trader; if (!t) return { ok: false, reason: 'No trader here' }; return S().buy(st, itemId, { stock: t.stock, mult: t.mult }); };

  // Move to a linked node. Passes the days (events may fire), discovers the node's neighbours and rolls the road for a chance meeting.
  // Returns { ok, days, events, wander }: if wander is set, something happens on the road before you arrive (the party is already at `to`; C.turnBack undoes it if the party is beaten).
  C.travel = function (st, to) {
    const from = st.world.location, days = C.travelCost(from, to);
    if (!days) return { ok: false, reason: 'No road from ' + from + ' to ' + to };
    if (!C.isDiscovered(st, to) && C.NODES[to].hidden && !st.world.flags['reveal_' + to]) return { ok: false, reason: 'You have not found that place yet' };   // an unmarked road out of where you stand can be followed; a hidden place cannot
    st.world.wander = null;
    if (C.NODES[from].dungeon) { const ds = dgState(st, C.NODES[from].dungeon); if (!ds.cleared) ds.stage = 0; }   // leaving a dungeon half-done: it closes up again
    const wander = C.rollWander(st, from, to, days);
    S().advanceDay(st, days); st.world.location = to; nodeState(st, to).visited = true;
    C.discover(st, to);   // arriving names the place; the roads out of it stay unmarked until you take them or hear of them
    S().markMet(st, C.ownerOf(st, to) || (C.REGIONS[C.NODES[to].region] || {}).faction);
    const revealed = autoReveal(st, to); C.lore(st, 'visit:' + to); C.loreSweep(st);
    const events = C.runEvents(st), sight = !wander && !events.length ? C.sight(st, from, to) : null; if (sight) events.push(sight);
    return { ok: true, days, from, events, wander, revealed };
  };
  C.dueEvents = st => C.EVENTS.filter(e => st.world.day >= e.day && !(st.world.flags['ev_' + e.id]));
  C.runEvents = function (st) {
    const fired = [];
    for (const e of C.dueEvents(st)) { st.world.flags['ev_' + e.id] = true; e.effect(st); fired.push({ id: e.id, text: e.text }); }
    return fired;
  };

  // ---- services at a node, by standing and owner ----
  // Who you can hire at a place: the race of its region. Only the races that are switched on can be hired.
  C.REGION_RACE = { dwarven_holds: 'dwarf', elven_realms: 'wood_elf', crownlands: 'human', free_marches: 'human', river_cities: 'human', voldun: 'human' };
  C.recruitRace = id => { const n = C.NODES[id], r = n && C.REGION_RACE[n.region]; return r && G().races[r] && G().races[r].active ? r : null; };
  const PRICE = { hostile: null, neutral: 1, friendly: 0.9, allied: 0.8 };
  const isHall = n => n.type === 'capital' || !!n.seat; // seats of a faction: capitals and halls
  C.nodeServices = function (st, id) {
    const n = C.NODES[id]; if (!n) return null;
    const owner = C.ownerOf(st, id), fac = n.faction || owner;
    const tier = fac && fac !== 'outlaws' ? S().standingTier(st, fac).id : 'neutral';
    const lost = owner === 'outlaws';
    const open = !lost && PRICE[tier] !== null && PRICE[tier] !== undefined;
    return {
      owner, tier, open,
      shop: n.shop && open ? (() => { const rs = C.rotateStock(st, id, n.shop.concat(n.shopFriendly && (tier === 'friendly' || tier === 'allied') ? n.shopFriendly : [])), ev = C.placeEvent(st, id), cal = C.calendar(st.world.day); return { stock: rs.stock, priceMult: Math.round(PRICE[tier] * C.shopMult(st, id) * 100) / 100, notes: rs.notes, event: ev && ev.mult !== 1 ? ev.name : null, festival: cal.festival && ['town', 'market', 'capital'].includes(n.type) ? cal.festival : null }; })() : null,
      recruit: n.recruit && open && C.recruitRace(id) ? { classes: S().entryClasses(), race: C.recruitRace(id) } : null,   // open unless Hostile (or besieged); the recruit's race is the region's
      join: isHall(n) && n.faction && !lost ? { faction: n.faction, can: S().tierIndex(tier) >= S().tierIndex(S().RULES.joinMinTier) } : null,
      encounter: encounterAvailable(st, id), choice: n.choice && !st.world.flags['choice_' + n.choice] && !(C.CHOICES[n.choice] && C.CHOICES[n.choice].job && !C.jobActive(st, C.CHOICES[n.choice].job)) ? n.choice : null,
      jobOffers: C.jobOffers(st, id), jobReports: C.jobReports(st, id),
      besieged: lost,
      tavern: C.hasTavern(id) && open && !lost ? { cost: C.calendar(st.world.day).festival ? 0 : C.TAVERN.cost, doneToday: (st.world.tavern || {})[id] === st.world.day } : null,
      dungeon: n.dungeon ? C.dungeonStatus(st, id) : null, bounty: C.bountyOptions(st, id)
    };
  };
  // Shopping at a node: stock and price multiplier come from the node's services (closed when hostile or besieged).
  C.buy = function (st, nodeId, itemId) {
    if (st.world.location !== nodeId) return { ok: false, reason: 'You are not there' };
    const sv = C.nodeServices(st, nodeId); if (!sv || !sv.shop) return { ok: false, reason: 'No shop open here' };
    const br = S().buy(st, itemId, { stock: sv.shop.stock, mult: sv.shop.priceMult }); if (br && br.ok) st.world.flags.g_buy = 1; return br;
  };
  // Any open shop buys from the stash at half the base price (standing does not change what you get for selling).
  C.sell = function (st, nodeId, itemId) {
    if (st.world.location !== nodeId) return { ok: false, reason: 'You are not there' };
    const sv = C.nodeServices(st, nodeId); if (!sv || !sv.shop) return { ok: false, reason: 'No shop open here' };
    return S().sell(st, itemId);
  };
  function encounterAvailable(st, id) {
    const n = C.NODES[id]; if (!n) return null;
    if (id === 'free_marches' && st.world.flags.marches_warned && !st.world.flags.marches_defended && !st.world.flags.marches_lost) return 'marches_defence';
    if (id === 'free_marches' && st.world.flags.marches_lost && !st.world.flags.marches_defended) return 'marches_defence';
    if (!n.encounter) return null;
    const e = C.ENCOUNTERS[n.encounter];
    if (e && e.job && (!C.jobActive(st, e.job) || st.world.flags[e.winFlag])) return null;
    return e && e.once && st.campaign.completed.includes(n.encounter) ? null : n.encounter;
  }

  // Resolve a choice node or a road event. Returns what changed (and fight: true when an option starts a battle).
  C.applyChoice = function (st, choiceId, optionId) {
    const c = C.CHOICES[choiceId]; let o = c && c.options.find(x => x.id === optionId);
    if (!o) return { ok: false, reason: 'Unknown choice' };
    if (o.stare) o = (st.party || []).length < 3 ? Object.assign({}, o, { fight: true }) : Object.assign({}, o, { gold: 15 });   // too few to frighten anyone: it comes to blows; otherwise they back off and drop their toll-pouch
    const keep = !c.road || c.once; // node choices and once-only road events are remembered
    if (keep && st.world.flags['choice_' + choiceId]) return { ok: false, reason: 'Already decided' };
    if (o.gold < 0 && st.inventory.gold < -o.gold) return { ok: false, reason: 'Not enough gold' };
    const changes = [];
    for (const [f, d] of Object.entries(o.standing || {})) changes.push(...S().changeStanding(st, f, d, { reason: c.text.slice(0, 24) }));
    if (o.gold) st.inventory.gold += o.gold;
    for (const [k, n] of Object.entries(o.items || {})) st.inventory.items[k] = (st.inventory.items[k] || 0) + n;
    if (o.flag) st.world.flags[o.flag] = true; if (o.jobFlag) st.world.flags[o.jobFlag] = true;
    for (const [a, b, d, both] of o.relations || []) S().shiftRelation(st, a, b, d, { both });
    const found = o.reveal ? C.revealAround(st, st.world.location, 2) : o.revealNear ? C.revealAround(st, st.world.location, 1) : [];
    if (keep) st.world.flags['choice_' + choiceId] = optionId;
    let fight = false;
    if (c.road) { st.world.lastRoadEvent = choiceId; const w = st.world.wander; if (o.fight && w) { const enc = wanderFight(st, w.region, 'fight', { to: w.to }); st.world.wander = Object.assign({}, w, { kind: 'fight', enc, text: 'It turns violent.' }); C.ENCOUNTERS.wander = enc; fight = true; } else st.world.wander = null; }
    return { ok: true, changes, found, fight, gold: o.gold || 0 };
  };

  // Enemy builds for an encounter (option id for encounters that let the player pick a side).
  // ---- fight size: enemy count by tier, and how many of your party a map can hold (design/party_slots_and_recruiting.md) ----
  // A map holds as many per side as its smaller spawn list (the sides can be swapped). The tier is 3/4/5/6 by level (S.RULES.fightTiers).
  C.mapCap = mapId => { const m = G().maps && G().maps[mapId]; return m && m.spawns && m.spawns.P && m.spawns.E ? Math.min(m.spawns.P.length, m.spawns.E.length) : 3; };
  C.tierFor = lv => { let n = 3; for (const [from, size] of S().RULES.fightTiers) if ((lv || 1) >= from) n = size; return n; };
  C.partyLimit = (st, mapId) => Math.min(S().fightTier(st), C.mapCap(mapId));
  // A written fight of the standard three enemies fields the tier's size from its recommended level (4 from 11, 5 from 21, 6 from 31), as far as its map has room.
  // The extras copy the written enemies in turn (never the leader or a named character) and get their own kits. A fight flagged `small`, an arena bout and any
  // fight not written with three enemies keeps what it was written with.
  C.scaleEnemies = function (e, o) {
    const list = o.enemies || [];
    if (e.arena || e.small || o.small || list.length !== 3) return list;
    const want = Math.min(C.tierFor(e.rec || 1), C.mapCap(e.map)); if (want <= list.length) return list;
    const ob = o.objective || e.objective || null, lead = ob && ob.type === 'leader' ? (ob.leader || 0) : -1;
    const pool = list.filter((u, i) => i !== lead), out = list.slice();
    for (let i = 0; out.length < want; i++) { const c = Object.assign({}, (pool.length ? pool : list)[i % (pool.length || list.length)]); delete c.name; delete c.keepClass; delete c.skills; delete c.secSkills; out.push(c); }
    return out;
  };
  C.encounterBuilds = function (encId, optionId) {
    const e = C.ENCOUNTERS[encId]; if (!e) return null;
    const o = e.options ? e.options.find(x => x.id === optionId) : e; if (!o) return null;
    return { map: e.map, swap: !!e.swap, name: e.name, rec: e.rec, level: e.rec, objective: o.objective || e.objective || null, reward: o.reward || e.reward, standing: o.standing || null,
      builds: C.scaleEnemies(e, o).map((u, i) => ({ id: 'e' + (i + 1), level: e.rec || 1, name: u.name || G().classes[u.primary].name, faction: o.enemyFaction, primary: u.primary, secondary: u.secondary || null, passives: u.passives || [],
        gear: LO().cleanGear(u.primary, u.gear || LO().defaultGear(u.primary), u.passives || []) })) };
  };
  // One line for the briefing: how this fight is won.
  C.objectiveText = function (ob, builds) {
    if (!ob || ob.type === 'rout') return 'Defeat every enemy.';
    const lim = ob.limit ? ' Within ' + ob.limit + ' rounds.' : '';
    if (ob.type === 'leader') { const b = (builds || [])[ob.leader || 0]; return 'Defeat ' + (b ? b.name : 'the enemy leader') + ' (marked with a crown).' + lim; }
    if (ob.type === 'survive') return 'Survive ' + ob.turns + ' rounds. Defeating every enemy also wins.';
    if (ob.type === 'reach') return (ob.label ? ob.label + ': ' : '') + 'get a party member onto the marked tile.' + lim;
    if (ob.type === 'hold') return (ob.label ? ob.label + ': ' : '') + 'keep a party member on the marked ground, with no enemy on it, at the start of ' + ob.turns + ' rounds.' + lim;
    return '';
  };
  // Apply the extra campaign results of a won encounter (standing bonus for the chosen side, item drops, free marches defended flag).
  C.applyEncounterResult = function (st, encId, optionId, res) {
    const info = C.encounterBuilds(encId, optionId); if (!info) return { ok: false };
    const out = S().applyBattleResult(st, res, { node: encId === 'wander' ? null : encId, days: encId === 'wander' ? 0 : undefined, gold: info.reward && info.reward.gold, xp: info.reward && info.reward.xp, jp: info.reward && info.reward.jp, rec: info.rec });
    const E = C.ENCOUNTERS[encId]; let dungeon = null;
    if (E && E.dungeon) { const D = C.DUNGEONS[E.dungeon], ds = dgState(st, E.dungeon);
      if (res.won) { ds.stage = E.floor; if (E.floor >= D.floors.length) { ds.cleared = true; ds.clearedDay = st.world.day; ds.clears++; dungeon = { id: E.dungeon, floor: E.floor, final: true, respawn: D.respawn || null }; } else dungeon = { id: E.dungeon, floor: E.floor, final: false }; }
      else { ds.stage = 0; dungeon = { id: E.dungeon, floor: E.floor, failed: true }; } }
    if (res.won) { st.world.flags.g_fight = 1; if (E && E.winFlag) st.world.flags[E.winFlag] = true; }
    if (dungeon && dungeon.final) C.lore(st, 'dungeon:' + dungeon.id);
    const proof = E && E.proofFor ? C.proofResult(st, E.proofFor, !!res.won) : null;
    if (res.won) {
      for (const [k, n] of Object.entries((info.reward && info.reward.items) || {})) st.inventory.items[k] = (st.inventory.items[k] || 0) + n;
      for (const [f, d] of Object.entries(info.standing || {})) S().changeStanding(st, f, d, { reason: info.name });
      if (encId === 'marches_defence') { st.world.flags.marches_defended = true; const n = nodeState(st, 'free_marches'); n.owner = 'crown'; n.besieged = false; S().changeStanding(st, 'crown', 30, { reason: 'defended the Marches' }); S().changeStanding(st, 'syndicate', 30, { reason: 'defended the Marches' }); }
    }
    return { ok: true, awards: out, dungeon, proof };
  };


  // ---- Bestiary: what the party has learned about each creature by fighting it. Seen once = what it is; twice = how it fights; three times = what hurts it. ----
  const FAM = { beast: 'Beast', undead: 'Undead and spirit', elemental: 'Elemental and construct', dragon: 'Dragonkin and horror' };
  const HAB = { dire_wolf: 'Hill meadows and forest edges. Packs follow the wounded.', cave_bear: 'Cold hills and tarns. Dangerous mostly when hungry or cornered.', giant_spider: 'Glass hollows, fords and mist. They like places where travellers stop.',
    ghoul: 'Gallows, battlefields and cairns, wherever the dead are poorly kept.', banshee: 'Burial grounds and pyre-fields; the old griefs that did not end.', bone_archer: 'Old battlefields and barrows, still shooting at a war that ended.',
    fire_elemental: 'Vents, ash and hot springs, wherever the ground is thin.', stone_golem: 'Ruins and old galleries. Built to guard, and it has not been told it can stop.', storm_elemental: 'High towers and bare peaks where lightning gathers.',
    drake_whelp: 'Ash fields and vents. Young drakes hunt alone and sleep on warm stone.', basilisk: 'Sulphur pools and glassy hollows, stone-grey like the rocks it lies on.', maw_horror: 'Fog and the deep places. It is not clear where it comes from.',
    elder_drake: 'Old drakes keep to the hearts of mountains and come out for no one.', barrow_king: 'A crowned dead lord below an old barrow, who has not yet agreed to be dead.' };
  const VIEWS = { beast: { canopy: 'The Wardens say a wild thing is a neighbour, and a starved one a danger. They tame what they can and cull what they must.', crown: 'The Crown pays a bounty on anything that takes a farmer\'s stock.', syndicate: 'The Syndicate buys pelts and asks no questions about the source.' },
    undead: { synod: 'The Synod holds that the unquiet dead are a debt, and sends wardens to lay them to rest.', crown: 'The Crown would prefer rumours of walking dead were not spoken of in market squares.' },
    elemental: { anvil: 'The Guild studies them; some call it science and some call it trespass.', ironbound: 'The Holds say the old guardians were built by their own ancestors, and are not to be broken without cause.' },
    dragon: { crown: 'Crown tax-rolls list a drake as an act of god, not a thing a lord can do anything about.', ironbound: 'Hold-songs call drakes the oldest creditors of the mountain.' } };
  C.BEASTS = {}; Object.entries(G().classes).forEach(([id, c]) => { if (c.monster) C.BEASTS[id] = { id, name: c.name, family: c.family, famName: FAM[c.family], boss: !!c.boss, hab: HAB[id] || '', views: VIEWS[c.family] || {} }; });
  const beastSt = st => (st.world.beasts = st.world.beasts || {});
  C.beastTier = (st, id) => { const n = (beastSt(st)[id] || {}).n || 0; return n >= 3 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0; };
  C.beastNote = (id, tier) => {
    const c = G().classes[id], B = C.BEASTS[id]; if (!c || !B) return null; const D = G(), t = c.traits || {}, out = { name: c.name, family: B.famName, hab: B.hab, boss: B.boss };
    if (tier >= 2) { out.moves = (c.ab || []).map(a => D.abilities[a].n + ': ' + D.abilities[a].desc); out.views = Object.entries(B.views).map(([f, x]) => ({ faction: f, text: x })); }
    if (tier >= 3) { const w = [], r = [];
      Object.entries(t.elemRes || {}).forEach(([e, v]) => { if (v < 0) w.push(e); else if (v >= 40) r.push(e); });
      const tough = []; if ((t.armor || 0) >= 30) tough.push('Blades barely scratch it.'); else if ((t.armor || 0) >= 15) tough.push('Thick hide: weapons bite less.'); if (t.rangedReduce) tough.push('Arrows lose force against it.'); if (t.pushImmune) tough.push('It cannot be shoved.');
      out.weak = w; out.resist = r; out.tough = tough; }
    return out;
  };
  // Every battle teaches: each monster kind in the fight counts once per battle (win or lose).
  { const prev = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, optionId, res) {
    const out = prev.apply(this, arguments), info = C.encounterBuilds(encId, optionId), seen = new Set(), news = [];
    if (info) info.builds.forEach(b => { if (C.BEASTS[b.primary] && !seen.has(b.primary)) { seen.add(b.primary); const bs = beastSt(st), e = bs[b.primary] || (bs[b.primary] = { n: 0 }), t0 = C.beastTier(st, b.primary); e.n++; const t1 = C.beastTier(st, b.primary); if (t1 > t0) news.push({ id: b.primary, tier: t1 }); } });
    if (news.length) out.bestiary = news; return out; }; }
  C.bestiaryList = st => Object.keys(C.BEASTS).map(id => ({ id, tier: C.beastTier(st, id), note: C.beastNote(id, C.beastTier(st, id)) })).filter(x => x.tier > 0);

  // Monster quests: the wild comes to the village's door.
  Object.assign(C.JOBS, {
    bear_tarn: { name: 'The Bear at the Tarn', giver: 'general', at: 'elk_meadow', after: null, offer: 'A herdsman holds up a torn bell. "A bear took the lead ewe from the high pasture and the flock will not graze. It lairs near Snowmelt Tarn. It had a wolf with it, if you can believe that."',
      steps: [{ text: 'Drive the bear from Snowmelt Tarn', flag: 'job_bear_won' }], done: 'The flock grazes again. The herdsman gives you a fleece-lined cloak and what coin the village can spare.', reward: { gold: 70, standing: { canopy: 10 } } },
    gallows_ghouls: { name: 'What Walks at Gallows Hill', giver: 'general', at: 'hobbs_reach', after: null, offer: 'The reeve of Hobb\'s Reach will not meet your eye. "Graves have been opened at Gallows Hill. Not dug. Opened, from inside. We pay for the burying and the burying does not hold."',
      steps: [{ text: 'Put down whatever haunts Gallows Hill', flag: 'job_ghouls_won' }], done: 'The reeve has the hill blessed and the graves filled. A Synod warden thanks you, quietly.', reward: { gold: 80, standing: { synod: 15, crown: 5 } } }
  });
  C.ENCOUNTERS.gq_bear = { name: 'The Bear at Snowmelt Tarn', map: 'classic_ridge', rec: 4, enemyFaction: 'wild', once: true, job: 'bear_tarn', winFlag: 'job_bear_won', enemies: [{ primary: 'cave_bear', name: 'Tarn Bear' }, { primary: 'dire_wolf', name: 'Starving Wolf' }], reward: { xp: 90, gold: 20 } };
  C.ENCOUNTERS.gq_ghouls = { name: 'Gallows Hill ghouls', map: 'gallows_hill', rec: 4, enemyFaction: 'wild', once: true, job: 'gallows_ghouls', winFlag: 'job_ghouls_won', enemies: [{ primary: 'ghoul', name: 'Gallows Ghoul' }, { primary: 'ghoul', name: 'Gallows Ghoul' }, { primary: 'bone_archer', name: 'Hanged Archer' }], reward: { xp: 100, gold: 25 } };
  C.NODES.snowmelt_tarn.encounter = 'gq_bear'; C.NODES.gallows_hill.encounter = 'gq_ghouls';

  // Data checks: graph symmetry, legal enemies, valid maps, shops, starts, events. Returns a list of problems (empty = fine).
  C.validate = function () {
    const p = [], D = G();
    for (const [id, n] of Object.entries(C.NODES)) {
      if (!n.pos || n.pos[0] < 0 || n.pos[0] > 1 || n.pos[1] < 0 || n.pos[1] > 1) p.push(id + ': bad position');
      for (const [to, d] of Object.entries(n.links)) { if (!C.NODES[to]) p.push(id + ' links to unknown ' + to); else if (C.NODES[to].links[id] !== d) p.push(id + '<->' + to + ' links are not symmetric'); }
      if (n.faction && !D.factions[n.faction]) p.push(id + ': unknown faction');
      if (n.owner && !D.factions[n.owner]) p.push(id + ': unknown owner');
      if (n.encounter && !C.ENCOUNTERS[n.encounter]) p.push(id + ': unknown encounter');
      if (n.choice && !C.CHOICES[n.choice]) p.push(id + ': unknown choice');
      (n.shop || []).forEach(g => { if (!D.gear[g]) p.push(id + ': unknown shop item ' + g); else if (!D.gear[g].price) p.push(id + ': shop item without a price ' + g); });
    }
    const unit = (where, u) => { const c = D.classes[u.primary]; if (!c || (c.selectable === false && !c.monster)) p.push(where + ': illegal class ' + u.primary); };
    const checkObj = (where, e, o) => { const ob = o.objective || e.objective; if (!ob) return;
      if (!['rout', 'leader', 'survive', 'reach', 'hold'].includes(ob.type)) { p.push(where + ': unknown objective ' + ob.type); return; }
      if ((ob.type === 'survive' || ob.type === 'hold') && !(ob.turns > 0)) p.push(where + ': ' + ob.type + ' needs turns');
      if (ob.type === 'leader' && !(ob.leader >= 0 && ob.leader < (o.enemies || []).length)) p.push(where + ': leader index out of range');
      if ((ob.type === 'reach' || ob.type === 'hold') && !ob.tiles && !['centre', 'enemy_camp', 'player_camp'].includes(ob.zone)) p.push(where + ': needs a zone or tiles');
      if (ob.limit !== undefined && !(ob.limit > 0)) p.push(where + ': bad round limit'); };
    const checkEnc = (where, o) => { if (!o.enemies || !o.enemies.length || o.enemies.length > 3) p.push(where + ': needs 1-3 enemies'); (o.enemies || []).forEach(u => unit(where, u)); if (o.enemyFaction !== 'outlaws' && o.enemyFaction !== 'wild' && !D.factions[o.enemyFaction]) p.push(where + ': unknown enemy faction');
      for (const g of Object.keys((o.reward && o.reward.items) || {})) if (!D.gear[g]) p.push(where + ': unknown reward item ' + g);
      for (const f of Object.keys(o.standing || {})) if (!D.factions[f]) p.push(where + ': unknown standing faction ' + f); };
    for (const [id, e] of Object.entries(C.ENCOUNTERS)) {
      if (!D.maps[e.map]) p.push(id + ': unknown map ' + e.map);
      if (e.options) e.options.forEach(o => { checkEnc(id + '/' + o.id, o); checkObj(id + '/' + o.id, e, o); }); else { checkEnc(id, e); checkObj(id, e, e); }
    }
    for (const [id, e] of Object.entries(C.ENCOUNTERS)) if (e.map && !G().maps[e.map]) p.push('encounter ' + id + ': unknown map ' + e.map);
    for (const [id, n] of Object.entries(C.NODES)) if (n.type === 'zone' && !G().maps[id]) p.push('zone ' + id + ' has no battle map');
    Object.entries(C.REGION_POOL).forEach(([r, t]) => { if (Object.values(G().maps).filter(m => m.pool === t).length < 2) p.push('region ' + r + ': fewer than two road maps in pool ' + t); });
    Object.entries(C.LORE_ON).forEach(([ev, ids]) => ids.forEach(i => { if (!C.LORE[i]) p.push('lore trigger ' + ev + ': unknown entry ' + i); }));
    Object.values(C.LORE).forEach(e => { if (!D.factions[e.faction]) p.push('lore ' + e.id + ': unknown faction'); if (e.follow && (!C.NODES[e.follow.visit] || (e.follow.gives && !C.LORE[e.follow.gives]))) p.push('lore ' + e.id + ': bad follow-up'); if (e.truth === false && !e.falseText) p.push('lore ' + e.id + ': false rumour needs falseText'); });
    Object.entries(C.INFORMANTS).forEach(([k, i]) => { if (!C.NODES[i.at] || !C.LORE[i.evidence] || !C.LORE[i.proof] || !C.SECRETS[i.sid]) p.push('informant ' + k + ': bad data'); });
    Object.entries(C.SECRETS).forEach(([k, x]) => { if (!C.LORE[x.proof] || !D.factions[x.faction] || !D.factions[x.rival]) p.push('secret ' + k + ': bad data'); x.squad.forEach(sq => sq.forEach(u => { const c = D.classes[u.primary]; if (!c || c.selectable === false) p.push('secret ' + k + ': illegal class ' + u.primary); })); });
    Object.entries(C.NPCS).forEach(([k, n]) => n.route.forEach(r => { if (!C.NODES[r]) p.push('npc ' + k + ': unknown place ' + r); }));
    Object.entries(C.ENCOUNTERS).forEach(([k, e]) => { if (e.job && !C.JOBS[e.job]) p.push('encounter ' + k + ': unknown job ' + e.job); });
    for (const [id, j] of Object.entries(C.JOBS)) { if (!C.NODES[j.at]) p.push('job ' + id + ': unknown place ' + j.at); if (j.after && !C.JOBS[j.after]) p.push('job ' + id + ': unknown prerequisite'); if (j.giver !== 'general' && !D.factions[j.giver]) p.push('job ' + id + ': unknown giver'); (j.steps || []).forEach(x => { if (x.visit && !C.NODES[x.visit]) p.push('job ' + id + ': unknown visit ' + x.visit); if (x.tavern && !C.hasTavern(x.tavern)) p.push('job ' + id + ': no tavern at ' + x.tavern); if (x.clear && !C.DUNGEONS[x.clear]) p.push('job ' + id + ': unknown dungeon ' + x.clear); if (x.flag && !Object.values(C.ENCOUNTERS).some(e => e.winFlag === x.flag) && !Object.values(C.CHOICES).some(c => (c.options || []).some(o => o.jobFlag === x.flag))) p.push('job ' + id + ': nothing sets flag ' + x.flag); }); Object.keys((j.reward || {}).standing || {}).forEach(f => { if (!D.factions[f]) p.push('job ' + id + ': unknown standing faction ' + f); }); ((j.reward || {}).reveal || []).forEach(d => { if (!C.NODES[d] || !C.NODES[d].hidden) p.push('job ' + id + ': reveal target not hidden ' + d); }); }
    for (const [id, c] of Object.entries(C.CHOICES)) for (const o of c.options) { for (const f of Object.keys(o.standing || {})) if (!D.factions[f]) p.push(id + '/' + o.id + ': unknown faction'); for (const [a, b] of o.relations || []) if (!D.factions[a] || !D.factions[b]) p.push(id + '/' + o.id + ': unknown relation faction'); }
    for (const [r, t] of Object.entries(C.STARTS)) {
      if (!D.races[r]) p.push('start ' + r + ': unknown race'); if (!C.NODES[t.location]) p.push('start ' + r + ': unknown location');
      t.discovered.forEach(n => { if (!C.NODES[n]) p.push('start ' + r + ': unknown node ' + n); });
      Object.keys(t.standing).forEach(f => { if (!D.factions[f]) p.push('start ' + r + ': unknown faction ' + f); });
      t.recruits.forEach(u => unit('start ' + r, u));
      if (D.races[r] && D.races[r].home !== t.location && !t.crossroads) p.push('start ' + r + ': location differs from the race home');
    }
    for (const [r, g] of Object.entries(C.REGIONS)) { if (!(g.danger >= 0 && g.danger <= 3)) p.push('region ' + r + ': bad danger'); if (g.faction && !D.factions[g.faction]) p.push('region ' + r + ': unknown faction'); }
    for (const [id, n] of Object.entries(C.NODES)) if (!C.REGIONS[n.region]) p.push(id + ': unknown region ' + n.region);
    C.EDGES.forEach(([a, b, d]) => { if (!C.NODES[a] || !C.NODES[b]) p.push('edge ' + a + '-' + b + ': unknown node'); if (!(d >= 1 && d <= 5)) p.push('edge ' + a + '-' + b + ': bad days'); });
    const sets = C.FOE_SETS.concat(C.MONSTER_SETS).map(x => [x.id, x]).concat(Object.entries(C.PATROLS));
    sets.forEach(([id, x]) => { (x.enemies || []).forEach(u => unit('foe ' + id, u)); if (!x.enemies || x.enemies.length < 1 || x.enemies.length > 3) p.push('foe ' + id + ': needs 1-3 enemies'); if (x.faction && x.faction !== 'outlaws' && x.faction !== 'wild' && !D.factions[x.faction]) p.push('foe ' + id + ': unknown faction'); (x.regions || []).forEach(r => { if (!C.REGIONS[r]) p.push('foe ' + id + ': unknown region ' + r); }); (x.zones || []).forEach(z => { if (!C.NODES[z] || C.NODES[z].type !== 'zone') p.push('foe ' + id + ': unknown zone ' + z); }); });
    for (const f of Object.keys(C.PATROLS)) if (!D.factions[f]) p.push('patrol ' + f + ': unknown faction');
    for (const [id, d] of Object.entries(C.DUNGEONS)) { const n = C.NODES[id]; if (!n) { p.push('dungeon ' + id + ': no node'); continue; } if (!C.NODES[d.parent] || !n.links[d.parent]) p.push('dungeon ' + id + ': not linked to its parent'); if (Object.keys(n.links).length !== 1) p.push('dungeon ' + id + ': should be a leaf');
      if (!d.floors.length || !d.floors[d.floors.length - 1].boss) p.push('dungeon ' + id + ': last floor must be a boss'); if (d.faction && !D.factions[d.faction]) p.push('dungeon ' + id + ': unknown faction'); if (d.hidden && !d.reveal) p.push('dungeon ' + id + ': hidden needs a reveal rule'); }
    for (const [id, n] of Object.entries(C.NODES)) if (n.type === 'zone' && !(n.danger >= 0 && n.danger <= 3)) p.push(id + ': zone needs danger 0-3');
    for (const [id, c] of Object.entries(C.CHOICES)) if (c.road) { (c.regions || []).forEach(r => { if (!C.REGIONS[r]) p.push(id + ': unknown region ' + r); }); if (!c.options.some(o => !o.gold || o.gold >= 0)) p.push(id + ': every option costs gold, so a broke party is stuck'); }
    // every node reachable from every start
    for (const [r, t] of Object.entries(C.STARTS)) { const seen = new Set([t.location]), q = [t.location]; while (q.length) { const x = q.pop(); for (const y of Object.keys(C.NODES[x].links)) if (!seen.has(y)) { seen.add(y); q.push(y); } } if (seen.size !== Object.keys(C.NODES).length) p.push('start ' + r + ': not every node is reachable'); }
    return p;
  };

  window.GAME_CAMPAIGN = C;
})();
