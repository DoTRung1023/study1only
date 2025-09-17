/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
/* eslint-disable no-param-reassign */
/* eslint-disable no-use-before-define */
/* eslint-disable no-undef */
const DEFAULT_PASSWORD = "default123";
let editTarget = null;
let deleteMode = false;
let resetTarget = null;


// Add this near the top of admin.js, after your global variables
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}


window.loadUsersFromDatabase = async function () {
  try {
    const res = await fetch('/users');
    const users = await res.json();
    const table = document.getElementById("userTable");
    table.innerHTML = "";

    users.forEach((user, index) => {
      const row = table.insertRow();
      row.dataset.userId = user.user_id; // store user_id

      // Check if this is the default admin account
      const isDefaultAdmin = user.username === 'advanmin';

      row.innerHTML = `
        <td>${index + 1}</td>
        <td><img src="${user.avatar_link || 'images/default-avatar.png'}" width="40" height="40" style="object-fit: cover; border-radius: 50%;" onerror="this.src='images/default-avatar.png'"></td>
        <td>${user.username}</td>
        <td>
          ${isDefaultAdmin
            ? '<span style="color: #999; font-style: italic; padding: 8px 12px;">Protected</span>'
            : `<button class="reset-btn" onclick="resetPassword(this)" title="Reset this user's password to default">
              <img src="images/reset-icon.png" alt="Reset password icon">
              <span>Reset password</span>
            </button>`
          }
        </td>
        <td><span>${user.address}</span></td>
        <td>
          <input type="hidden" value="${user.total_study_time || "00:00:00"}">
          <span>${user.total_study_time || "00:00:00"}</span>
        </td>
        <td><span>${user.region || "N/A"}</span></td>
        <td><span>${new Date(user.created_date).toLocaleDateString() || "N/A"}</span></td>
        <td><span>${user.role.toUpperCase()}</span></td>
        <td class="edit-column">
          ${isDefaultAdmin
            ? '<span style="color: #999; font-style: italic;">Protected</span>'
            : `<button class="edit-btn" onclick="toggleEdit(this)" title="Edit this user's information">
              <img src="images/edit-user.png" alt="Edit user" width="16" height="16">
            </button>
            <span class="edit-icons" style="display:none;">
              <button onclick="openConfirmModal(this)" title="Save changes to this user">
                <img src="images/user-plus.png" alt="Confirm" width="16" height="16">
              </button>
              <button onclick="cancelEdit(this)" title="Cancel editing or delete this user">
                <img src="images/user-minus.png" alt="Cancel" width="16" height="16">
              </button>
            </span>`
          }
        </td>
      `;
    });

    updateRowNumbers();

    // Re-apply sorting if it was previously set (WITHOUT showing toast)
    if (currentSortField && currentSortDirection) {
      // Update the visual state first
      const iconElement = document.getElementById(`${currentSortField}-sort-icon`);
      const imgElement = document.getElementById(`${currentSortField}-sort-img`);

      if (iconElement && imgElement) {
        // Reset all icons first
        document.querySelectorAll('.sort-icon').forEach((icon) => {
          icon.classList.remove('active');
        });

        // Set active icon and correct image
        imgElement.src = currentSortDirection === 'asc' ? 'images/arrow-up.png' : 'images/arrow-down.png';
        iconElement.classList.add('active');
      }

      sortTable(currentSortField, currentSortDirection, false); // false = don't show toast
    }

  } catch (err) {
    showToast("Failed to load users.");
  }
};

window.addUser = async function () {
  const table = document.getElementById("userTable");
  const row = table.insertRow();
  row.classList.add("editable-row");

  // Create the region dropdown first (now async)
  const regionDropdown = await createRegionDropdown();

  row.innerHTML = `
    <td></td>
    <td><img src="images/default-avatar.png" width="40" height="40" style="object-fit: cover; border-radius: 50%;" onerror="this.src='images/default-avatar.png'"></td>
    <td><input type="text" placeholder="Username"></td>
    <td>
      <input type="text" value="${DEFAULT_PASSWORD}" readonly class="new-password-temp">
    </td>
    <td><input type="text" placeholder="City"></td>
    <td>
      <input type="hidden" value="00:00:00">
      <span>00:00:00</span>
    </td>
    <td class="region-dropdown-cell"></td>
    <td>Auto-generated</td>
    <td>
      <select class="role-dropdown">
        <option>User</option>
        <option>Admin</option>
      </select>
    </td>
    <td class="edit-column">
      <button class="edit-btn" onclick="toggleEdit(this)" style="display: none;" title="Edit this user's information">
        <img src="images/edit-user.png" alt="Edit user" width="16" height="16">
      </button>
      <span class="edit-icons" style="display:inline-block;">
        <button onclick="openConfirmModal(this)" title="Save this new user">
          <img src="images/user-plus.png" alt="Confirm" width="16" height="16">
        </button>
        <button onclick="cancelEdit(this)" title="Cancel adding this user">
          <img src="images/user-minus.png" alt="Cancel" width="16" height="16">
        </button>
      </span>
    </td>
  `;

  // Insert the region dropdown into the placeholder cell
  const regionCell = row.querySelector('.region-dropdown-cell');
  regionCell.appendChild(regionDropdown);

  updateRowNumbers();
};

window.searchUser = async function() {
  const searchQuery = document.getElementById("searchInput").value.trim().toLowerCase();

  try {
    const res = await fetch('/users');
    let users = await res.json();

    if (searchQuery) {
      // Filter users by username if there's a search query
      users = users.filter((user) => user.username.toLowerCase().includes(searchQuery));
    }
    // If searchQuery is empty, show all users (no filtering)

    const table = document.getElementById("userTable");
    table.innerHTML = "";

    if (users.length === 0 && searchQuery) {
      // Show "no results" message only when there's a search query
      table.innerHTML = `
        <tr>
          <td colspan="10" class="no-results">
            No users found matching "${searchQuery}"
          </td>
        </tr>
      `;
      return;
    }

    // Display users
    users.forEach((user, index) => {
      const row = table.insertRow();
      row.dataset.userId = user.user_id;

      // Check if this is the default admin account
      const isDefaultAdmin = user.username === 'advanmin';

      row.innerHTML = `
        <td>${index + 1}</td>
        <td><img src="${user.avatar_link || 'images/default-avatar.png'}" width="40" height="40" style="object-fit: cover; border-radius: 50%;" onerror="this.src='images/default-avatar.png'"></td>
        <td>${user.username}</td>
        <td>
          ${isDefaultAdmin
            ? '<span style="color: #999; font-style: italic; padding: 8px 12px;">Protected</span>'
            : `<button class="reset-btn" onclick="resetPassword(this)" title="Reset this user's password to default">
              <img src="images/reset-icon.png" alt="Reset password icon">
              <span>Reset password</span>
            </button>`
          }
        </td>
        <td><span>${user.address}</span></td>
        <td>
          <input type="hidden" value="${user.total_study_time || "00:00:00"}">
          <span>${user.total_study_time || "00:00:00"}</span>
        </td>
        <td><span>${user.region || "N/A"}</span></td>
        <td><span>${new Date(user.created_date).toLocaleDateString() || "N/A"}</span></td>
        <td><span>${user.role.toUpperCase()}</span></td>
        <td class="edit-column">
          ${isDefaultAdmin
            ? '<span style="color: #999; font-style: italic;">Protected</span>'
            : `<button class="edit-btn" onclick="toggleEdit(this)" title="Edit this user's information">
              <img src="images/edit-user.png" alt="Edit user" width="16" height="16">
            </button>
            <span class="edit-icons" style="display:none;">
              <button onclick="openConfirmModal(this)" title="Save changes to this user">
                <img src="images/user-plus.png" alt="Confirm" width="16" height="16">
              </button>
              <button onclick="cancelEdit(this)" title="Cancel editing or delete this user">
                <img src="images/user-minus.png" alt="Cancel" width="16" height="16">
              </button>
            </span>`
          }
        </td>
      `;
    });

    updateRowNumbers();

    // Re-apply sorting if it was previously set (WITHOUT showing toast)
    if (currentSortField && currentSortDirection) {
      sortTable(currentSortField, currentSortDirection, false); // false = don't show toast
    }

  } catch (err) {
    showToast("Failed to search users.");
  }
};

// Global variables to track current sort state
let currentSortField = null;
let currentSortDirection = null;

// Toggle sort function for header clicks
window.toggleSort = function(field) {
  const iconElement = document.getElementById(`${field}-sort-icon`);
  const imgElement = document.getElementById(`${field}-sort-img`);

  // Reset all sort icons
  document.querySelectorAll('.sort-icon').forEach((icon) => {
    icon.classList.remove('active');
  });

  // Determine new sort direction
  let direction;
  if (currentSortField === field) {
    // Toggle direction if same field is clicked again
    direction = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    // Default to ascending for a new field
    direction = 'asc';
  }

  // Update icon image and class
  imgElement.src = direction === 'asc' ? 'images/arrow-up.png' : 'images/arrow-down.png';
  iconElement.classList.add('active');

  // Store current settings and sort
  currentSortField = field;
  currentSortDirection = direction;

  // Call existing sort function
  sortTable(field, direction);
};

// Update the sortTable function to control toast display
window.sortTable = function(field, direction, showToast = true) {

  // Store current sort settings
  currentSortField = field;
  currentSortDirection = direction;

  // Get all rows except the header
  const table = document.getElementById("userTable");
  const rows = Array.from(table.rows);

  // Sort the rows
  rows.sort((a, b) => {
    let valueA;
let valueB;

    if (field === 'time') {
      // Get time values from the hidden inputs (column index 5)
      const inputA = a.cells[5].querySelector('input');
      const inputB = b.cells[5].querySelector('input');
      valueA = (inputA && inputA.value) || "00:00:00";
      valueB = (inputB && inputB.value) || "00:00:00";

      // Convert time strings to comparable values (seconds)
      valueA = timeToSeconds(valueA);
      valueB = timeToSeconds(valueB);
    } else if (field === 'date') {
      // Get date values (column index 7)
      const dateTextA = a.cells[7].textContent.trim();
      const dateTextB = b.cells[7].textContent.trim();

      // Handle "Auto-generated" or "N/A" values
      if (dateTextA === "Auto-generated" || dateTextA === "N/A") {
        valueA = direction === 'asc' ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
      } else {
        try {
          // Parse the date string - handle different formats
          valueA = new Date(dateTextA).getTime();
          if (isNaN(valueA)) {
            // Try parsing using specific format if toLocaleDateString was used
            const parts = dateTextA.split('/');
            if (parts.length === 3) {
              valueA = new Date(parts[2], parts[0] - 1, parts[1]).getTime();
            }
          }
        } catch (e) {
          valueA = direction === 'asc' ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
        }
      }

      if (dateTextB === "Auto-generated" || dateTextB === "N/A") {
        valueB = direction === 'asc' ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
      } else {
        try {
          valueB = new Date(dateTextB).getTime();
          if (isNaN(valueB)) {
            const parts = dateTextB.split('/');
            if (parts.length === 3) {
              valueB = new Date(parts[2], parts[0] - 1, parts[1]).getTime();
            }
          }
        } catch (e) {
          valueB = direction === 'asc' ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
        }
      }
    }

    // Sort direction logic
    if (direction === 'asc') {
      return valueA - valueB;
    }
      return valueB - valueA;

  });

  // Rearrange table based on sort
  rows.forEach((row) => {
    table.appendChild(row);
  });

  // Update row numbers after sorting
  updateRowNumbers();

  // Show user-friendly feedback message only when explicitly requested
if (showToast) {
  if (field === 'time') {
    showToastMessage(`Sorted by Total Time (${direction === 'asc' ? 'lowest to highest' : 'highest to lowest'})`);
  } else {
    showToastMessage(`Sorted by Created Date (${direction === 'asc' ? 'oldest to newest' : 'newest to oldest'})`);
  }
}
};

// Helper function to convert time string (HH:MM:SS) to seconds
function timeToSeconds(timeStr) {
  if (!timeStr) return 0;

  const parts = timeStr.split(':');
  if (parts.length !== 3) return 0;

  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseInt(parts[2], 10) || 0;

  return (hours * 3600) + (minutes * 60) + seconds;
}

// Filter countries
let countryList = [];
let selectedRegions = [];
let isRegionFilterActive = false;

window.toggleRegionFilter = function(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('regionFilterDropdown');
  const header = event.currentTarget; // This will be the th element now
  const buttonImg = header.querySelector('.filter-button');

  if (dropdown.classList.contains('show')) {
    dropdown.classList.remove('show');
    buttonImg.classList.remove('active');
    header.classList.remove('active'); // Remove active class to re-enable tooltip
  } else {
    // Calculate header position relative to viewport
    const headerRect = header.getBoundingClientRect();

    // Position dropdown below the header
    let topPosition = headerRect.bottom + 5;
    let leftPosition = headerRect.left;

    // Check boundaries and adjust if needed
    const dropdownWidth = 250;
    const dropdownHeight = 400;

    // Adjust horizontal position if dropdown goes off-screen
    if (leftPosition + dropdownWidth > window.innerWidth) {
      leftPosition = window.innerWidth - dropdownWidth - 10;
    }

    // Adjust vertical position if dropdown goes off-screen
    if (topPosition + dropdownHeight > window.innerHeight) {
      topPosition = headerRect.top - dropdownHeight - 5;
    }

    // Apply calculated positions
    dropdown.style.left = leftPosition + 'px';
    dropdown.style.top = topPosition + 'px';

    // Show the dropdown
    dropdown.classList.add('show');
    buttonImg.classList.add('active');
    header.classList.add('active'); // Add active class to disable tooltip

    // Load countries if not already loaded
    if (countryList.length === 0) {
      fetchCountries();
    }
  }
};

// Fetch countries from REST Countries API
async function fetchCountries(){
  try {
    const response = await fetch('https://restcountries.com/v3.1/all?fields=name');
    const data = await response.json();

    // Sort alphabetically
    countryList = data.sort((a, b) => a.name.common.localeCompare(b.name.common));

    populateCountryDropdown(countryList);

    // Set up real-time search after countries are loaded
    const searchInput = document.getElementById('regionSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', handleRegionSearch);
    }
  } catch(error){
    showToast('Failed to load country');
  }
}

function populateCountryDropdown(countries) {
  const countryListElement = document.getElementById('countryList');
  countryListElement.innerHTML = '';

  countries.forEach((country) => {
    const countryName = country.name.common;
    const isChecked = selectedRegions.includes(countryName);

    const countryOption = document.createElement('div');
    countryOption.className = 'country-option';
    countryOption.innerHTML = `
      <input type="checkbox" class="country-checkbox" id="country-${countryName}"
             value="${countryName}" ${isChecked ? 'checked' : ''}>
      <label for="country-${countryName}">${countryName}</label>
    `;

    // Make the entire row clickable - including the country name
    countryOption.addEventListener('click', function(e) {
      // Always toggle checkbox when clicking anywhere on the row
      const checkbox = this.querySelector('.country-checkbox');
      checkbox.checked = !checkbox.checked;

      // Update the selected regions immediately for UI feedback
      updateSelectedRegionsFromUI();
    });

    // Also listen for direct checkbox changes (for keyboard accessibility)
    countryOption.querySelector('.country-checkbox').addEventListener('change', function(e) {
      // Stop propagation to prevent double-firing from the row click
      e.stopPropagation();
      updateSelectedRegionsFromUI();
    });

    countryListElement.appendChild(countryOption);
  });

  // Add real-time search functionality to the search input
  const searchInput = document.getElementById('regionSearchInput');
  if (searchInput) {
    // Remove any existing event listeners to prevent duplicates
    searchInput.removeEventListener('input', handleRegionSearch);
    // Add the real-time search event listener
    searchInput.addEventListener('input', handleRegionSearch);
  }
}

// Real-time search handler for region dropdown
function handleRegionSearch(event) {
  const searchTerm = event.target.value.toLowerCase();

  // Update selected regions from current UI state before filtering
  updateSelectedRegionsFromUI();

  // Filter countries based on search term
  // eslint-disable-next-line max-len
  const filteredCountries = countryList.filter((country) => country.name.common.toLowerCase().includes(searchTerm));

  // Re-populate the dropdown with filtered countries
  const countryListElement = document.getElementById('countryList');
  countryListElement.innerHTML = '';

  filteredCountries.forEach((country) => {
    const countryName = country.name.common;
    const isChecked = selectedRegions.includes(countryName);

    const countryOption = document.createElement('div');
    countryOption.className = 'country-option';
    countryOption.innerHTML = `
      <input type="checkbox" class="country-checkbox" id="country-${countryName}"
             value="${countryName}" ${isChecked ? 'checked' : ''}>
      <label for="country-${countryName}">${countryName}</label>
    `;

    // Make the entire row clickable
    countryOption.addEventListener('click', function(e) {
      const checkbox = this.querySelector('.country-checkbox');
      checkbox.checked = !checkbox.checked;
      updateSelectedRegionsFromUI();
    });

    // Direct checkbox changes
    countryOption.querySelector('.country-checkbox').addEventListener('change', function(e) {
      e.stopPropagation();
      updateSelectedRegionsFromUI();
    });

    countryListElement.appendChild(countryOption);
  });
}

function updateSelectedRegionsFromUI() {
  const visibleCheckboxes = document.querySelectorAll('.country-checkbox:checked');
  const currentlySelected = Array.from(visibleCheckboxes).map((checkbox) => checkbox.value);

  const visibleCountryNames = Array.from(document.querySelectorAll('.country-checkbox')).map((cb) => cb.value);
  selectedRegions = selectedRegions.filter((region) => !visibleCountryNames.includes(region));

  currentlySelected.forEach((country) => {
    if (!selectedRegions.includes(country)) {
      selectedRegions.push(country);
    }
  });

  // Update the info display
  updateSelectedCountriesInfo();
}

// Update this function to handle longer text better
function updateSelectedCountriesInfo() {
  const infoElement = document.getElementById('selectedCountriesInfo');
  if (selectedRegions.length === 0) {
    infoElement.textContent = '';
  } else if (selectedRegions.length === 1) {
    infoElement.textContent = `Selected: ${selectedRegions[0]}`;
  } else if (selectedRegions.length <= 3) {
    infoElement.textContent = `Selected: ${selectedRegions.join(', ')}`;
  } else {
    infoElement.textContent = `Selected: ${selectedRegions.length} countries`;
    infoElement.title = selectedRegions.join(', '); // Show full list on hover
  }
}

// Helper function to create region dropdown for new users
async function createRegionDropdown(selectedValue = '') {
  const select = document.createElement('select');
  select.className = 'role-dropdown'; // Reuse the same styling as role dropdown
  select.style.width = '100%';

  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select Region';
  defaultOption.disabled = true;
  defaultOption.selected = !selectedValue;
  select.appendChild(defaultOption);

  // If countries aren't loaded yet, fetch them first
  if (!countryList || countryList.length === 0) {
    // Add loading option
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Loading countries...';
    loadingOption.disabled = true;
    select.appendChild(loadingOption);

    // Fetch countries and then populate
    try {
      await fetchCountries();
      // Remove loading option
      select.removeChild(loadingOption);
      // Add real countries
      populateSelectWithCountries(select, selectedValue);
    } catch (error) {
      // Remove loading option and add error message
      select.removeChild(loadingOption);
      const errorOption = document.createElement('option');
      errorOption.value = '';
      errorOption.textContent = 'Failed to load countries';
      errorOption.disabled = true;
      select.appendChild(errorOption);
    }
  } else {
    // Countries are already loaded, populate immediately
    populateSelectWithCountries(select, selectedValue);
  }

  return select;
}

// Helper function to populate select element with countries
function populateSelectWithCountries(select, selectedValue) {
  countryList.forEach((country) => {
    const option = document.createElement('option');
    option.value = country.name.common;
    option.textContent = country.name.common;
    if (selectedValue === country.name.common) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// Update the applyRegionFilter function to include info update
window.applyRegionFilter = function() {
  updateSelectedRegionsFromUI(); // Make sure we have the latest selections

  // Toggle filter state
  isRegionFilterActive = selectedRegions.length > 0;

  // Filter the user table
  filterUsersByRegion();

  // Close the dropdown
  document.getElementById('regionFilterDropdown').classList.remove('show');
  document.querySelector('.filter-button').classList.toggle('active', isRegionFilterActive);

  // Show feedback with specific regions selected
  if (isRegionFilterActive) {
    if (selectedRegions.length === 1) {
      showToast(`Filtered by: ${selectedRegions[0]}`);
    } else {
      showToast(`Filtered by ${selectedRegions.length} regions: ${selectedRegions.slice(0, 3).join(', ')}${selectedRegions.length > 3 ? '...' : ''}`);
    }
  }
};

// Clear all region filters
window.clearRegionFilter = function() {
  selectedRegions = [];
  isRegionFilterActive = false;

  // Uncheck all checkboxes
  document.querySelectorAll('.country-checkbox').forEach((checkbox) => {
    checkbox.checked = false;
  });

  updateSelectedCountriesInfo();

  // Reset the table to show all users
  loadUsersFromDatabase();

  // Close the dropdown
  document.getElementById('regionFilterDropdown').classList.remove('show');
  document.querySelector('.filter-button').classList.remove('active');

  showToast('Region filters cleared');
};


// Filter users by selected regions
function filterUsersByRegion() {
  // If no filters active, show all users
  if (selectedRegions.length === 0) {
    loadUsersFromDatabase();
    return;
  }

  // Otherwise, filter the users based on our selected regions
  fetch('/users')
    .then((response) => response.json())
    .then((users) => {
      // Filter users based on region
      const filteredUsers = users.filter((user) => selectedRegions.includes(user.region)
        || (user.region === null && selectedRegions.includes('N/A')));

      // Display the filtered users
      displayFilteredUsers(filteredUsers);
    })
    .catch((error) => {
      showToast('Failed to filter users');
    });
}

// Display the filtered users in the table
function displayFilteredUsers(users) {
  const table = document.getElementById("userTable");
  table.innerHTML = "";

  if (users.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="10" class="no-results">
          No users found in the selected regions
        </td>
      </tr>
    `;
    return;
  }

  // Display the filtered users
  users.forEach((user, index) => {
    const row = table.insertRow();
    row.dataset.userId = user.user_id;

    // Check if this is the default admin account
    const isDefaultAdmin = user.username === 'advanmin';

    row.innerHTML = `
          <td>${index + 1}</td>
      <td><img src="${user.avatar_link || 'images/default-avatar.png'}" width="40" height="40" style="object-fit: cover; border-radius: 50%;" onerror="this.src='images/default-avatar.png'"></td>
      <td>${user.username}</td>
      <td>
        ${isDefaultAdmin
          ? '<span style="color: #999; font-style: italic; padding: 8px 12px;">Protected</span>'
          : `<button class="reset-btn" onclick="resetPassword(this)" title="Reset this user's password to default">
            <img src="images/reset-icon.png" alt="Reset password icon">
            <span>Reset password</span>
          </button>`
        }
      </td>
      <td><span>${user.address}</span></td>
      <td>
        <input type="hidden" value="${user.total_study_time || "00:00:00"}">
        <span>${user.total_study_time || "00:00:00"}</span>
      </td>
      <td><span>${user.region || "N/A"}</span></td>
      <td><span>${new Date(user.created_date).toLocaleDateString() || "N/A"}</span></td>
      <td><span>${user.role.toUpperCase()}</span></td>
      <td class="edit-column">
        ${isDefaultAdmin
          ? '<span style="color: #999; font-style: italic;">Protected</span>'
          : `<button class="edit-btn" onclick="toggleEdit(this)" title="Edit this user's information">
            <img src="images/edit-user.png" alt="Edit user" width="16" height="16">
          </button>
          <span class="edit-icons" style="display:none;">
            <button onclick="openConfirmModal(this)" title="Save changes to this user">
              <img src="images/user-plus.png" alt="Confirm" width="16" height="16">
            </button>
            <button onclick="cancelEdit(this)" title="Cancel editing or delete this user">
              <img src="images/user-minus.png" alt="Cancel" width="16" height="16">
            </button>
          </span>`
        }
      </td>
    `;
  });

  updateRowNumbers();

  // Re-apply sorting if it was previously set (WITHOUT showing toast)
  if (currentSortField && currentSortDirection) {
    sortTable(currentSortField, currentSortDirection, false); // false = don't show toast
  }
}
// Update this part in your window.onload function
document.addEventListener('click', function(event) {
  const dropdown = document.getElementById('regionFilterDropdown');
  const filterHeader = document.querySelector('.filter-header');

  if (dropdown && !dropdown.contains(event.target)
      && filterHeader && !filterHeader.contains(event.target)) {
    dropdown.classList.remove('show');
    const button = document.querySelector('.filter-button');
    if (button && !isRegionFilterActive) {
      button.classList.remove('active');
    }
    // Remove active class from header to re-enable tooltip
    if (filterHeader) {
      filterHeader.classList.remove('active');
    }
  }
});


window.toggleEdit = async function (btn) {
  const row = btn.closest("tr");
  const icons = row.querySelector(".edit-icons");
  const editBtn = row.querySelector(".edit-btn");

  const cells = row.querySelectorAll("td");
  const username = cells[2].textContent.trim();

  // Prevent editing of default admin account
  if (username === 'advanmin') {
    showToast("Cannot edit the default admin account.");
    return;
  }
  const address = cells[4].textContent.trim();
  const inputEl = cells[5].querySelector("input");
  const total = inputEl ? inputEl.value : "00:00:00";
  const region = cells[6].textContent.trim(); // Region in position 6
  const role = cells[8].textContent.trim(); // Role moved to position 8

  cells[2].innerHTML = `<input type="text" value="${username}">`;
  cells[3].innerHTML = `
    <button class="reset-btn" onclick="resetPassword(this)" title="Reset this user's password to default">
      <img src="images/reset-icon.png" alt="Reset password icon">
      <span>Reset password</span>
    </button>
  `;
  cells[4].innerHTML = `<input type="text" value="${address}">`;
  // Maintain consistent structure for Total Time column during edit
  cells[5].innerHTML = `
    <input type="hidden" value="${total}">
    <input type="text" value="${total}" readonly class="total-time-input">
  `;
  // Create region dropdown for editing (now async)
  const regionDropdown = await createRegionDropdown(region === 'N/A' ? '' : region);
  cells[6].innerHTML = '';
  cells[6].appendChild(regionDropdown);

  // Created date is read-only, no need to modify
  cells[8].innerHTML = `
    <select class="role-dropdown">
      <option ${role.toLowerCase() === "user" ? "selected" : ""}>User</option>
      <option ${role.toLowerCase() === "admin" ? "selected" : ""}>Admin</option>
    </select>
  `;

  if (icons && editBtn) {
    icons.style.display = "inline-block";
    editBtn.style.display = "none";
  }
};

window.openConfirmModal = function (btn) {
  editTarget = btn;
  deleteMode = false; // Ensure that it is not in delete mode
  document.getElementById("confirmModal").style.display = "flex";
};

window.closeModal = function () {
  document.getElementById("confirmModal").style.display = "none";
  editTarget = null;
  deleteMode = false;
};

window.prepareDelete = function (btn) {
  deleteMode = true;
  openConfirmModal(btn);
};

window.confirmEditFromModal = async function () {
  if (!editTarget) return;

  const row = editTarget.closest("tr");
  const { userId } = row.dataset;
  const isNew = row.classList.contains("editable-row") || !userId;

  const cells = row.querySelectorAll("td");
  const usernameInput = cells[2].querySelector("input");
  const addressInput = cells[4].querySelector("input");
  const totalInput = cells[5].querySelector("input");
  const roleSelect = cells[8].querySelector("select");

  const username = (usernameInput && usernameInput.value.trim()) || "";
  const address = (addressInput && addressInput.value.trim()) || "";
  const total = (totalInput && totalInput.value) || "00:00:00";

  // Get region from dropdown instead of input
  const regionSelect = cells[6].querySelector("select");
  const region = regionSelect ? regionSelect.value : "";

  const role = (roleSelect && roleSelect.value) || "User";

  try {
    if (deleteMode) {
      const { userId } = row.dataset;
      try {
        const res = await fetch(`/users/${userId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Failed to delete user");
        row.remove();
        updateRowNumbers();
        showToast("User deleted.");
      } catch (err) {
        showToast("Delete failed.");
      }
      closeModal();
      return;
    }

    // ✅ Validate input fields with username length check (1-10 characters)
    if (!username || !address || !region) {
      showToast("Username, address, and region are required.");
      return;
    }

    // Add username length validation (changed to 1-10 characters to match signup)
    if (username.length < 1 || username.length > 10) {
      showToast("Username must be between 1 and 10 characters.");
      return;
    }

    let createdDate; // Variable to store the actual created date

    if (isNew) {
      // ✅ Add new user

      const res = await fetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
 username, address, total_study_time: total, role, region
})
      });

      const result = await res.json();
      if (!res.ok) {

        // Check for specific error types and show appropriate messages
        if (res.status === 409 || result.message.includes('duplicate') || result.message.includes('exists')) {
          showToast("User name already exist");
        } else if (res.status === 400) {
          showToast(`Invalid input: ${result.message}`);
        } else {
          showToast("Failed to add user. Please try again.");
        }
        return; // Don't continue with UI updates
      }

      row.classList.remove("editable-row");
      row.dataset.userId = result.user_id;

      // Get the actual created date from the response or create current date
      createdDate = result.created_date
        ? new Date(result.created_date).toLocaleDateString()
        : new Date().toLocaleDateString();

      showToast("User added successfully!");
    } else {
      // ✅ Update existing user
      const res = await fetch(`/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
 username, address, total_study_time: total, role, region
})
      });

      if (!res.ok) {
        const result = await res.json();

        // Check for specific error types for updates too
        if (res.status === 409 || result.message.includes('duplicate') || result.message.includes('exists')) {
          showToast("User name already exist");
        } else if (res.status === 400 && result.message.includes('Username')) {
          showToast("Username must be between 1 and 10 characters.");
        } else {
          showToast("Failed to update user. Please try again.");
        }
        return;
      }

      // For existing users, keep the current created date
      createdDate = cells[7].textContent.trim();

      showToast("User updated successfully!");
    }

    // ✅ Update UI display with proper span wrappers for styling
    cells[2].textContent = username;
    cells[3].innerHTML = `
      <button class="reset-btn" onclick="resetPassword(this)" title="Reset this user's password to default">
        <img src="images/reset-icon.png" alt="Reset password icon">
        <span>Reset password</span>
      </button>
    `;
    cells[4].innerHTML = `<span>${address}</span>`;
    // Ensure Total Time column maintains exact same structure as other rows
    cells[5].innerHTML = `
      <input type="hidden" value="${total}">
      <span>${total}</span>
    `;
    // Force the cell and its content to maintain proper alignment
    cells[5].style.verticalAlign = 'middle';
    cells[5].style.textAlign = 'center';
    cells[5].style.padding = '20px 10px';

    // Ensure the span maintains proper styling
    const span = cells[5].querySelector('span');
    if (span) {
      span.style.verticalAlign = 'middle';
      span.style.display = 'inline-block';
    }
    cells[6].innerHTML = `<span>${region}</span>`; // Update region display with span
    cells[7].innerHTML = `<span>${createdDate}</span>`; // Update created date with span
    cells[8].innerHTML = `<span>${role.toUpperCase()}</span>`; // Update role display with span

    const icons = row.querySelector(".edit-icons");
    const editBtn = row.querySelector(".edit-btn");
    if (icons && editBtn) {
      icons.style.display = "none";
      editBtn.style.display = "inline-block";
    }

    closeModal();
    updateRowNumbers();
  } catch (err) {
    showToast("Operation failed.");
  }
};


window.cancelEdit = function (btn) {
  const row = btn.closest("tr");

  // If it's a new unsaved row → remove it immediately
  if (!row.dataset.userId || row.classList.contains("editable-row")) {
    row.remove();
    updateRowNumbers();
    return;
  }

  // For existing rows → trigger custom confirm modal for deletion
  deleteMode = true;
  editTarget = btn;

  const modal = document.getElementById("confirmModal");
  modal.querySelector("h3").textContent = "Update?";
  modal.querySelector("p").textContent = "Are you sure you want to perform this action?";
  modal.style.display = "flex";
};


window.updateRowNumbers = function () {
  const rows = document.querySelectorAll("#userTable tr");
  rows.forEach((row, index) => {
    const numberCell = row.querySelector("td:first-child");
    if (numberCell) {
      numberCell.textContent = index + 1;
    }

    // Ensure consistent cell alignment after renumbering
    const cells = row.querySelectorAll("td");
    cells.forEach((cell, cellIndex) => {
      if (cellIndex >= 4 && cellIndex <= 8) { // Styled columns
        cell.style.verticalAlign = 'middle';
        if (cellIndex === 5) { // Total Time column
          cell.style.textAlign = 'center';
        }
      }
    });
  });
};

window.onload = function () {
  if (typeof loadUsersFromDatabase === 'function') {
    loadUsersFromDatabase();

    // Create debounced search function (300ms delay)
    const debouncedSearch = debounce(searchUser, 300);

    // Add real-time search with debouncing
    const searchInput = document.getElementById("searchInput");

    // Real-time search on input
    searchInput.addEventListener("input", function() {
      debouncedSearch();
    });

    // Keep the Enter key functionality for immediate search
    searchInput.addEventListener("keypress", function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        searchUser(); // Immediate search on Enter (no debounce)
      }
    });

    // Initialize the region filter dropdown
    document.getElementById('regionFilterDropdown').addEventListener('click', function(event) {
      // Prevent clicks inside dropdown from closing it
      event.stopPropagation();
    });

    // Close dropdowns when clicking elsewhere on the page
    document.addEventListener('click', function(event) {
      const dropdown = document.getElementById('regionFilterDropdown');
      const filterIcon = document.querySelector('.filter-icon');

      if (dropdown && !dropdown.contains(event.target)
          && filterIcon && !filterIcon.contains(event.target)) {
        dropdown.classList.remove('show');
        const button = document.querySelector('.filter-button');
        if (button && !isRegionFilterActive) {
          button.classList.remove('active');
        }
      }
    });

  } else { /* empty */ }
};

window.logout = async function () {
  try {
    // Call server to invalidate session
    const response = await fetch('/users/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error('Logout failed');
    }

    // Clear all user-related data (including timer state)
    if (typeof window.clearAllUserState === 'function') {
      window.clearAllUserState();
    } else {
      localStorage.clear();
    }

    // Redirect to login page
    window.location.href = '/login.html';
  } catch (error) {
    // Even if server logout fails, clear local data and redirect
    if (typeof window.clearAllUserState === 'function') {
      window.clearAllUserState();
    } else {
      localStorage.clear();
    }
    window.location.href = '/login.html';
  }
};

window.resetPassword = function (btn) {
  const row = btn.closest("tr");
  const username = row.querySelectorAll("td")[2].textContent.trim();

  // Prevent resetting password for default admin account
  if (username === 'advanmin') {
    showToast("Cannot reset password for the default admin account.");
    return;
  }

  fetch('/users/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.message.includes("success")) {
        showToast("Password reset.");
      } else {
        showToast("Reset failed.");
      }
    })
    .catch((err) => {
      showToast("Server error.");
    });
};

function showToastMessage(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.style.display = "none";
    }, 500);
  }, 3000);
}

// Keep the old function name as an alias for backward compatibility
window.showToast = showToastMessage;
