var priceCache = {};
var allContracts = [];
var currentPrice = priceCache[contract];	


async function fetchContracts() {
    return fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=300&page=1&sparkline=false')
        .then(response => response.json())
        .then(data => {
            allContracts = data.map(coin => ({id: coin.id, symbol: coin.symbol}));
            return allContracts;
        })
        .catch(error => console.error('Error:', error));
}


function filterContracts() {
    var searchValue = document.getElementById('contractSearch').value.toLowerCase();
    var filteredContracts = allContracts.filter(contract => 
        contract.id.includes(searchValue) || contract.symbol.includes(searchValue)
        );
    var contractSelect = document.getElementById('contract');
    contractSelect.innerHTML = '';
    filteredContracts.forEach(contract => {
        var option = document.createElement('option');
        option.value = contract.id;
        option.innerText = contract.id + ' (' + contract.symbol.toUpperCase() + ')';
        contractSelect.appendChild(option);
    });
}


async function refreshPrices() {
    console.log(allContracts);

    var contracts = ['bitcoin', 'ethereum', 'dogecoin'];
    for (let contract of contracts) {
            priceCache[contract] = await getCurrentPrice(contract);
        }
    loadPositions();
}
  

function calculatePNL(entryPrice, currentPrice, quantity, positionType) {
        
    var pnl;
    if (positionType === 'long') {
        pnl = (currentPrice - entryPrice) * quantity;
    } else if (positionType === 'short') {
        pnl = (entryPrice - currentPrice) * quantity;
    }
    return pnl.toFixed(2);
    
}

function calculateROI(size, margin) {
    var roi = ((size/ margin) * 100);
    return roi.toFixed(2) + '%';
}

async function getCurrentPrice(contract) {
    return fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${contract}&vs_currencies=usd`)
        .then(response => response.json())
        .then(data => Number(data[contract].usd).toFixed(2))
        .catch(error => console.error('Error:', error));
}

function calculateSizeOrQuantity(target) {
    var contract = document.getElementById('contract').value;
    var entryPrice = parseFloat(document.getElementById('entryPrice').value);
    var size = parseFloat(document.getElementById('size').value);
    var quantity = parseFloat(document.getElementById('quantity').value);
    
    if (currentPrice && size && target === 'quantity') {
        quantity = (size / currentPrice);
        document.getElementById('quantity').value = quantity;
    } else if (currentPrice && quantity && target === 'size') {
        size = (currentPrice * quantity).toFixed(2);
        document.getElementById('size').value = size;
    }
    
}

async function addPosition(positionType) {
    var contract = document.getElementById('contract').value;
    var entryPrice = parseFloat(document.getElementById('entryPrice').value);
    var size = parseFloat(document.getElementById('size').value);
    var quantity = parseFloat(document.getElementById('quantity').value);
    var leverage = parseInt(document.getElementById('leverageInput').value);
    var currentPrice = priceCache[contract] || await getCurrentPrice(contract);
    var margin = (size / leverage).toFixed(2);
    var pnl = calculatePNL(entryPrice, currentPrice, quantity, positionType);

    if (positionType === 'short') {
        size = -size;
        quantity = -quantity;
    }

    var positions = JSON.parse(localStorage.getItem('positions')) || [];
    positions.push({ contract, entryPrice, size, quantity, leverage, currentPrice, pnl, margin, positionType });
    localStorage.setItem('positions', JSON.stringify(positions));
   
    loadPositions();
}




function deletePosition(index) {
    var positions = JSON.parse(localStorage.getItem('positions'));
    positions.splice(index, 1);
    localStorage.setItem('positions', JSON.stringify(positions));
    loadPositions();
}


  function combineContracts(a, b) {
    var newSize, newQuantity;
    if (a.positionType === 'short') {
        newSize = (Number(a.size) - Number(b.size)).toFixed(2);
        newQuantity = (Number(a.quantity) - Number(b.quantity)).toFixed(8);  // Increase the decimal places
    } else {
        newSize = (Number(a.size) + Number(b.size)).toFixed(2);
        newQuantity = (Number(a.quantity) + Number(b.quantity)).toFixed(8);  // Increase the decimal places
    }

    return {
        contract: a.contract,
        leverage: a.leverage > b.leverage ? a.leverage : b.leverage,
        size: newSize,
        quantity: newQuantity,
        entryPrice: ((Number(a.entryPrice) + Number(b.entryPrice)) / 2).toFixed(2),
        currentPrice: Number(a.currentPrice),
        pnl: (Number(a.pnl) + Number(b.pnl)),
        margin: (Number(a.margin) + Number(b.margin)).toFixed(2),
        roi: (((Number(a.size) + Number(b.size)) / (Number(a.margin) + Number(b.margin))) * 100).toFixed(2) + '%',
        positionType: a.positionType,
    };
}



function sortPositions(positions, sortType) {
    if (sortType === 'contract') {
        positions.sort((a, b) => a.contract.localeCompare(b.contract));
        var i = 0;
        while (i < positions.length - 1) {
            if (positions[i].contract === positions[i+1].contract) {
                                        console.log("called")
                positions[i] = combineContracts(positions[i], positions[i+1]);
                positions.splice(i+1, 1);
            } else {
                i++;
            }
        }
    }
    return positions;
}

 async function loadPositions() {
    var positions = JSON.parse(localStorage.getItem('positions')) || [];
    var table = document.getElementById('positionsTable');
    var filter = document.getElementById('filterCheckbox').checked;
    var contractFilter = document.getElementById('contract').value;
    var sortType = document.getElementById('sort').value;

    positions = sortPositions(positions, sortType);

    while (table.rows.length > 1) {
        table.deleteRow(1);
    }

    for (let i = 0; i < positions.length; i++) {
        let position = positions[i];

        if (filter && position.contract !== contractFilter) {
            continue;
        }

        var currentPrice = priceCache[position.contract];
        
        var pnl = calculatePNL(position.entryPrice, position.currentPrice, position.quantity, position.positionType)
	   
		
        var size = parseFloat(currentPrice * position.quantity).toFixed(2);
        var quantity = position.quantity;
        var positionColorClass = position.positionType === 'short' ? 'position-short' : 'position-long';
        if (position.positionType === 'short') {
                 size = -Math.abs(size);    // Ensure it's negative
            quantity = -Math.abs(quantity);   // Ensure it's negative
        }
        var roi = calculateROI(pnl, position.margin);

        var row = table.insertRow();
        row.insertCell(0).innerHTML = position.contract;
        row.insertCell(1).innerHTML = position.leverage;
        var sizeCell = row.insertCell(2);
        sizeCell.innerHTML = size;
        sizeCell.classList.add(positionColorClass);
        var quantityCell = row.insertCell(3);
        quantityCell.innerHTML = quantity;
        quantityCell.classList.add(positionColorClass);
        row.insertCell(4).innerHTML = position.entryPrice;
        row.insertCell(5).innerHTML = currentPrice;
		
		var pnlCell = row.insertCell(6);
        pnlCell.innerHTML = roi  + ' (' + pnl + ')';
        pnlCell.classList.add(pnl < 0 ? 'pnl-negative' : 'pnl-positive');
		
        row.insertCell(7).innerHTML = position.margin;
        var deleteButton = document.createElement('button');
        deleteButton.innerText = 'Delete';
        deleteButton.onclick = function() { deletePosition(i); };
        row.insertCell(8).appendChild(deleteButton);

       
    }
}






function updateLeverageInput(value) {
    document.getElementById('leverageInput').value = value;
    document.getElementById('leverageDisplay').innerText = value;
}

function updateLeverageSlider(value) {
    document.getElementById('leverageSlider').value = value;
    document.getElementById('leverageDisplay').innerText = value;
}
		
function downloadLocalStorage() {
    var obj = {};
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var value = localStorage[key];
        obj[key] = JSON.parse(value);
    }
    var json = JSON.stringify(obj);
    var blob = new Blob([json], {type: "application/json"});
    var url  = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.download = "backup.json";
    a.href = url;
    a.click();

}

function importLocalStorage() {
    var fileInput = document.getElementById('jsonFile');
    
    if (!fileInput.files.length) {
        console.log("No file selected");
        return;
    }

    var file = fileInput.files[0];
    console.log(file)
    var reader = new FileReader();
    console.log(reader)
   

    reader.onload = function(e) {
        var content = e.target.result;
        console.log(content)
        try {
            var data = JSON.parse(content);
            console.log(data)
            for (var key in data) {
                localStorage.setItem(key, JSON.stringify(data[key]));
                loadPositions();
                console.log(localStorage)
            }
        } catch (e) {
            console.error('Failed to parse JSON:', e);
        }
    };
    reader.readAsText(file);
    
}



window.onload = function() {
    fetchContracts().then(contracts => {
        filterContracts();
        refreshPrices();
    });
};