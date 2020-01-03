var relics
var items = [];
var callBank = [];
var completed = 0;

if(i = localStorage.getItem('items')){
	items = JSON.parse(i);
}

$.ajax({
    dataType: "json",
    url: 'https://drops.warframestat.us/data/relics.json',
    success: function(data) {
        relics = data['relics'];
    }
}).done(function() {
	for (var i = relics.length - 1; i >= 0; i--) {
		if(relics[i]['state'] != "Radiant"){
			relics.splice(i, 1);
		} else{
			relics[i]['urlName'] = nameToUrl(relics[i]['tier']+' '+relics[i]['relicName']);
		}
	}
  	calcRelics();
});

$(document).ready(function(){
	
});

function calcRelics(){
	//calcRelic(relics[0])
	for (var i = relics.length - 1; i >= 0; i--) {
		calcRelic(relics[i]);
	}
}

function calcRelic(relic){
	for (var i = relic.rewards.length - 1; i >= 0; i--) {
		getItem(nameToUrl(relic.rewards[i].itemName), relic, relic.rewards[i])
	}
}

function getItem(name, relic, relic_reward){
	//console.log('a relic', relic)
	var now = new Date()
	if(item = items.find(ele => ele.urlName === name)){
		time = new Date(item.datetime)
		if( ((now - time) / 36e5) < 24) {//Check if older than 24 hours
			relic_reward['market_stats'] = item;
			checkRelicCompleted(relic)
			return;
		}
	}

	if(r = callBank.find(ele => ele.url_name === name)){
		if(!r['relics'].find(ele => ele.relic.urlName === relic.urlName)){
			r['relics'].push({'relic': relic, 'relic_reward': relic_reward})
		}
	} else{
		var callIndex = (callBank.push({'url_name': name, 'relics': [{'relic': relic, 'relic_reward': relic_reward}]})) -1
		var itemIndex;
		$.ajax({
		    dataType: "json",
		    url: 'https://api.warframe.market/v1/items/'+name+'/statistics',
		    success: function(data) {
		    	current = data.payload.statistics_closed['48hours'].pop()
		    	if(!current){
		    		current = data.payload.statistics_closed['90days'].pop()
		    	}
		    	current['urlName'] = name;
		        itemIndex = items.push(current) - 1;
		        localStorage.setItem('items', JSON.stringify(items))
		        for (var i = callBank[callIndex]['relics'].length - 1; i >= 0; i--) {
		        	current = callBank[callIndex]['relics'].pop();
		        	//console.log(current)
		        	current['relic_reward']['market_stats'] = items[itemIndex];
		        	checkRelicCompleted(current.relic)
		        }
		        callBank[callIndex] = null;
		        
		    },
		    error: function(){
		    	current = {'urlName': name, 'datetime': now.getTime(), 'failed': true}
		    	items.push(current)
		    	localStorage.setItem('items', JSON.stringify(items))
		    	callBank[callIndex] = null;
		    	checkRelicCompleted(relic)
		    	//console.log('FAILED')
		    }
		})
	}
}

function nameToUrl(name){
	if(name.match('Systems Blueprint') || name.match('Chassis Blueprint') || name.match('Neuroptics Blueprint')){
		name = name.substr(0, name.length - 10);
	}
	return name.replace(/ /g,'_').toLocaleLowerCase();
}

function arrayIsEmpty(arr){
	if(arr.length == 0){
		return true;
	} else{
		for (var i = arr.length - 1; i >= 0; i--) {
			if(arr[i] != null){
				return false;
			}
		}
		return true;
	}

	return false;
}

function checkRelicCompleted(relic){
	complete = 0
	for (var i = relic.rewards.length - 1; i >= 0; i--) {
		if(relic.rewards[i].market_stats){
			//Set min for the relic
			if(!relic.plat_min || relic.plat_min > relic.rewards[i].market_stats.avg_price){
				relic.plat_min = relic.rewards[i].market_stats.avg_price;
			}

			//Set max for the relic
			if(!relic.plat_max || relic.plat_max < relic.rewards[i].market_stats.avg_price){
				relic.plat_max = relic.rewards[i].market_stats.avg_price;
			}
			complete++;
		}
	}

	if(complete == relic.rewards.length){
		relic.complete = true;
		completed++
		$('#progress').text(completed+'/'+relics.length)
	} else{
		relic.complete = false;
	}

	if(completed == relics.length){
		for (var i = relics.length - 1; i >= 0; i--) {
			relics[i]['commonRewards'] = getRewards(relics[i], 'Common')
			relics[i]['uncommonRewards'] = getRewards(relics[i], 'Uncommon')
			relics[i]['rareRewards'] = getRewards(relics[i], 'Rare')
		}
		
		var table = $('#relicTable').DataTable( {
			orderCellsTop: true,
			fixedHeader: true,
		    data: relics,
		    columns: [
		        { title: 'Tier', data: 'tier' },
		        { title: 'Relic', data: 'relicName' },
		        { title: 'Common', data: 'commonRewards' },
		        { title: 'Uncommon', data: 'uncommonRewards' },
		        { title: 'Rare', data: 'rareRewards' },
		        { title: 'Min', data: 'plat_min' },
		        { title: 'Max', data: 'plat_max' }
		    ]
		} );

		$('#relicTable tfoot th').each( function () {
	        var title = $(this).text();
	        $(this).html( '<input type="text" placeholder="Search '+title+'" />' );
	    } );

	    table.columns().every( function () {
            var that = this;
     
            $( 'input', this.footer() ).on( 'keyup change clear', function () {
                if ( that.search() !== this.value ) {
                    that
                        .search( this.value )
                        .draw();
                }
            } );
        } );

	}
	
}

function getRewards(relic, rarity){
	var r = [];
	for (var i = relic.rewards.length - 1; i >= 0; i--) {
		if(relic.rewards[i].rarity == 'Uncommon' && relic.rewards[i].chance < 20 && relic.rewards[i].chance > 10){
			relic.rewards[i].rarity = 'Common'
		} else if (relic.rewards[i].rarity == 'Uncommon' && relic.rewards[i].chance == 10){
			relic.rewards[i].rarity = 'Rare'
		}

		if(relic.rewards[i].rarity == rarity){
			r.push(relic.rewards[i].itemName+' ('+(relic.rewards[i]['market_stats']['avg_price']?relic.rewards[i]['market_stats']['avg_price']:'N/A')+')')
		}
	}
	return r.join('<br/>');
}