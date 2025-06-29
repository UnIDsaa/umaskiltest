document.addEventListener('DOMContentLoaded', () => {
    const USER_DB_KEY = 'umaSkillChecker_userData_v13'; // v13 key is fine for compatibility
    let DB = {
        master: {},
        user: {}
    };

    let currentDeck = {
        scenario: null,
        inza: [null, null],
        supportCards: [null, null, null, null, null, null]
    };
    let skillCheckStates = {};

    // --- DOM 요소 캐싱 ---
    const themeToggle = document.getElementById('theme-toggle');
    const scenarioSelect = document.getElementById('scenario-select');
    const inzaSelects = document.querySelectorAll('.inza-select');
    const scSelects = document.querySelectorAll('.sc-select');
    const skillListContainer = document.getElementById('skill-list-container');
    const acquiredSkillsSection = document.getElementById('acquired-skills-section');
    const acquiredSkillsContainer = document.getElementById('acquired-skills-container');
    const resetSkillsBtn = document.getElementById('reset-skills');
    const downloadBtn = document.getElementById('download-button');
    const uploadBtn = document.getElementById('upload-button');
    const uploadInput = document.getElementById('upload-json');
    const resetDataBtn = document.getElementById('reset-data-button');
    const hideAcquiredToggle = document.getElementById('hide-acquired-toggle');
    const showDetailsToggle = document.getElementById('show-details-toggle');
    const clickAreaToggle = document.getElementById('click-area-toggle');
    
    // 모달 관련 요소
    const openTargetModalBtn = document.getElementById('open-target-modal-btn');
    const targetModal = document.getElementById('target-modal');
    const manageCollectionBtn = document.getElementById('manage-collection-btn');
    const collectionModal = document.getElementById('collection-modal');
    const collectionViewContainer = document.getElementById('collection-view-container');
    const skillSearchModal = document.getElementById('skill-search-modal');
    const targetBubblesContainer = document.getElementById('target-bubbles-container');
    const importJsonInput = document.getElementById('import-json-input');

    // --- 데이터 관리 ---
    function saveUserData() {
        try {
            DB.user.savedDeck = currentDeck;
            DB.user.skillCheckStates = skillCheckStates;
            localStorage.setItem(USER_DB_KEY, JSON.stringify(DB.user));
        } catch (error) {
            console.error("localStorage 저장 실패:", error);
            alert("데이터 저장에 실패했습니다. 브라우저의 저장 공간이 부족할 수 있습니다.");
        }
    }

    function loadUserData() {
        try {
            const savedData = localStorage.getItem(USER_DB_KEY);
            return savedData ? JSON.parse(savedData) : createDefaultUserData();
        } catch (error) {
            console.error("저장된 사용자 데이터 파싱 실패:", error);
            if (confirm("저장된 사용자 데이터를 불러오는 데 실패했습니다. 데이터를 초기화하시겠습니까?")) {
                localStorage.removeItem(USER_DB_KEY);
                return createDefaultUserData();
            }
            throw error;
        }
    }

    function createDefaultUserData() {
        return {
            version: "1.5.0",
            userSettings: { theme: 'light', hideAcquired: false, showDetails: false, clickArea: 'checkbox', lastCollectionTab: 'sc' },
            customData: { skills: [], supportCards: [], inzaCharacters: [] },
            myCollection: { supportCards: [], inzaCharacters: [] },
            targetSkills: { required: [], ignored: [] },
            savedDeck: { scenario: null, inza: [null, null], supportCards: [null, null, null, null, null, null] },
            skillCheckStates: {}
        };
    }

    async function loadMasterData() {
        try {
            const response = await fetch('masterData.json?v=1.5.0');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('마스터 데이터 로드 실패:', error);
            alert('필수 데이터 로드에 실패했습니다. 앱을 사용할 수 없습니다.');
            return null;
        }
    }

    function applyUserData(data) {
        DB.user = data || {};
        DB.user.userSettings = { ...createDefaultUserData().userSettings, ...data.userSettings };
        DB.user.customData = data.customData || { skills: [], supportCards: [], inzaCharacters: [] };
        DB.user.myCollection = data.myCollection || { supportCards: [], inzaCharacters: [] };
        DB.user.targetSkills = data.targetSkills || { required: [], ignored: [] };

        currentDeck = data.savedDeck || createDefaultUserData().savedDeck;
        skillCheckStates = data.skillCheckStates || {};
        
        hideAcquiredToggle.checked = DB.user.userSettings.hideAcquired;
        showDetailsToggle.checked = DB.user.userSettings.showDetails;
        clickAreaToggle.checked = DB.user.userSettings.clickArea === 'full';

        applyTheme(DB.user.userSettings.theme);
        applyDetailsVisibility(DB.user.userSettings.showDetails);
    }
    
    // --- 메인 렌더링 ---
    function renderAll() {
        populateSelectors();
        const obtainableSkills = getObtainableSkills();
        renderSkillList(obtainableSkills);
        updateTargetProgress(obtainableSkills);
    }

    // --- UI 렌더링 (메인 화면) ---
    function populateSelectors() {
        const selectedScIds = scSelects.length > 0 ? Array.from(scSelects).map(s => s.value).filter(Boolean) : [];
        const selectedInzaIds = inzaSelects.length > 0 ? Array.from(inzaSelects).map(s => s.value).filter(Boolean) : [];
    
        const scenarioOptions = (DB.master.scenarios || []).map(s => `<option value="${s.scenarioId}">${s.name}</option>`).join('');
        scenarioSelect.innerHTML = '<option value="">-- 시나리오 --</option>' + scenarioOptions;
        if(currentDeck.scenario) scenarioSelect.value = currentDeck.scenario;
    
        const allInza = (DB.user.myCollection.inzaCharacters || []).sort((a,b) => a.name.localeCompare(b.name, 'ko'));
        const inzaOptions = allInza.map(inza => {
            const masterInza = findMasterInza(inza.masterInzaId);
            const prefix = masterInza?.isCustom ? '✏️ ' : '';
            return `<option value="${inza.userInzaId}">${prefix}${inza.name}</option>`;
        }).join('');
        inzaSelects.forEach((select, index) => {
            const currentValue = currentDeck.inza[index] || '';
            select.innerHTML = '<option value="">-- 인자 선택 --</option>' + inzaOptions;
            Array.from(select.options).forEach(opt => {
                if(selectedInzaIds.includes(opt.value) && opt.value !== currentValue) {
                    opt.disabled = true;
                }
            });
            select.value = currentValue;
        });

        const allSc = (DB.user.myCollection.supportCards || []).sort((a,b) => a.name.localeCompare(b.name, 'ko'));
        const scOptions = allSc.map(sc => {
            const masterCard = findMasterSc(sc.masterCardId);
            const prefix = masterCard?.isCustom ? '✏️ ' : '';
            const levelInfo = getCardLevelInfo(sc);
            return `<option value="${sc.userCardId}">${prefix}${sc.name} (${levelInfo.text})</option>`;
        }).join('');
        scSelects.forEach((select, index) => {
            const currentValue = currentDeck.supportCards[index] || '';
            select.innerHTML = '<option value="">-- 선택 --</option>' + scOptions;
            Array.from(select.options).forEach(opt => {
                if(selectedScIds.includes(opt.value) && opt.value !== currentValue) {
                    opt.disabled = true;
                }
            });
            select.value = currentValue;
        });
    }

    function findMasterSc(masterCardId) {
        return (DB.master.supportCards || []).find(c => c.masterCardId === masterCardId) || 
               (DB.user.customData.supportCards || []).find(c => c.masterCardId === masterCardId);
    }
    
    function findMasterInza(masterInzaId) {
        return (DB.master.inzaCharacters || []).find(i => i.masterInzaId === masterInzaId) || 
               (DB.user.customData.inzaCharacters || []).find(i => i.masterInzaId === masterInzaId);
    }

    function getCardLevelInfo(userCard) {
        if (!userCard) return { text: '', hintLevel: 0 };
        
        const masterCard = findMasterSc(userCard.masterCardId);
        
        let hintLevel = userCard.hintLevel || 0;
        if (masterCard?.levelMapping) {
            hintLevel = masterCard.levelMapping[userCard.level] || 1;
        } else if (masterCard?.isCustom) {
            hintLevel = masterCard.hintLevel || 0;
        }

        let text = `돌파 ${userCard.level}`;
        if (userCard.level === 4) text += ' (풀돌)';
        if (userCard.level === 0) text += ' (명함)';
        if (hintLevel > 0) text += `, 힌트Lv.${hintLevel}`;

        return { text, hintLevel };
    }

    function getSkillData(skillId) {
        if (!skillId) return null;
        return (DB.master.skills || []).find(s => s.skillId === skillId) || 
               (DB.user.customData.skills || []).find(s => s.skillId === skillId);
    }
    
    function findSkillByName(name) {
        if (!name) return null;
        return (DB.master.skills || []).find(s => s.name === name) ||
               (DB.user.customData.skills || []).find(s => s.name === name);
    }

    function renderSkillList(obtainableSkills) {
        const lists = { scenarioOnly: [], inzaOnly: [], supportOnly: [], common: [], acquired: [] };
        const hideAcquired = hideAcquiredToggle.checked;

        Object.values(obtainableSkills).forEach(skill => {
            const isAcquired = skillCheckStates[skill.skillId] === 2;
            if (isAcquired) lists.acquired.push(skill);
            if (!isAcquired || !hideAcquired) {
                distributeSkill(lists, skill);
            }
        });

        let html = '';
        if (Object.keys(obtainableSkills).length === 0 && lists.acquired.length === 0) {
            html = '<p class="placeholder">덱을 편성하면 획득 가능한 스킬 목록이 여기에 표시됩니다.</p>';
        } else {
            const groupsInOrder = [
                { title: '🌌 시나리오 스킬', data: lists.scenarioOnly },
                { title: '🟪 인자로만 얻는 스킬', data: lists.inzaOnly },
                { title: '🟦 서포트로만 얻는 스킬', data: lists.supportOnly },
                { title: '🟩 복합 획득 스킬', data: lists.common }
            ];

            groupsInOrder.forEach(group => {
                if (group.data.length > 0) {
                    html += createGroupHtml(group.title, group.data);
                }
            });

            if (!html && hideAcquired) {
                 html = '<p class="placeholder">획득할 스킬이 없거나 모두 획득했습니다.</p>';
            }
        }
        
        skillListContainer.innerHTML = html || '<p class="placeholder">덱을 편성해주세요.</p>';
        acquiredSkillsContainer.innerHTML = createSubGroupHtml(lists.acquired);
        acquiredSkillsSection.hidden = (lists.acquired.length === 0);
        acquiredSkillsSection.open = !hideAcquired && lists.acquired.length > 0;
    }
    
    function distributeSkill(lists, skill) {
        const types = new Set(skill.sources.map(s => {
            if (s.type === '인자' || s.type === '고유' || s.type === '고유(인자)') return 'inza';
            if (s.type === '시나리오' || s.type === '금색-시나리오') return 'scenario';
            return 'support';
        }));
        if (types.size === 1) {
            if (types.has('inza')) lists.inzaOnly.push(skill);
            else if (types.has('scenario')) lists.scenarioOnly.push(skill);
            else lists.supportOnly.push(skill);
        } else {
            lists.common.push(skill);
        }
    }

    function createGroupHtml(title, skills) {
        const subGroups = { common: [], distance: [], style: [] };
        skills.forEach(skill => {
            const skillData = getSkillData(skill.skillId);
            const category = skillData?.category || 'common';
            if (!subGroups[category]) subGroups[category] = [];
            subGroups[category].push(skill);
        });

        let finalHtml = '';
        const categoryOrder = ['common', 'distance', 'style'];
        let hasPreviousContent = false;

        categoryOrder.forEach(category => {
            if (subGroups[category] && subGroups[category].length > 0) {
                if (hasPreviousContent) finalHtml += `<div class="sub-group-divider"></div>`;
                finalHtml += createSubGroupHtml(subGroups[category]);
                hasPreviousContent = true;
            }
        });

        if (!finalHtml) return '';
        return `<div class="skill-group"><h3>${title}</h3>${finalHtml}</div>`;
    }

	function createSubGroupHtml(skills) {
		const upgradeOrder = { 'gold': 1, 'evolved': 2, 'normal': 3 };
		const effectOrder = { 'passive': 1, 'heal': 2, 'debuff': 3, 'normal': 4 };
		const clickAreaClass = DB.user.userSettings.clickArea === 'full' ? 'clickable' : '';

		skills.sort((a, b) => {
			const skillA_Data = getSkillData(a.skillId);
			const skillB_Data = getSkillData(b.skillId);
			if (!skillA_Data || !skillB_Data) return 0;
			if (skillA_Data.isUnique !== skillB_Data.isUnique) return skillA_Data.isUnique ? -1 : 1;
			const orderA = upgradeOrder[skillA_Data.upgradeType] || 99;
			const orderB = upgradeOrder[skillB_Data.upgradeType] || 99;
			if (orderA !== orderB) return orderA - orderB;
			const effectOrderA = effectOrder[skillA_Data.effectType] || 99;
			const effectOrderB = effectOrder[skillB_Data.effectType] || 99;
			if (effectOrderA !== effectOrderB) return effectOrderA - effectOrderB;
			return a.name.localeCompare(b.name, 'ko');
		});
		
		return skills.map(skill => {
			const skillData = getSkillData(skill.skillId);
			if (!skillData) return '';
			const state = skillCheckStates[skill.skillId] || 0;
			const isTarget = (DB.user.targetSkills.required || []).includes(skill.skillId);
			const sources = skill.sources.map(s => `${s.name}(${s.type}${s.level ? ` Lv.${s.level}`: ''})`).join(', ');
			
			let classList = `skill-item ${clickAreaClass}`;
			
			if (skillData.isUnique) {
				classList += ' skill-item--unique';
			} else {
				if (skillData.upgradeType) classList += ` skill-item--${skillData.upgradeType}`;
			}
			
			if (skillData.isCustom && skillData.showCustomHighlight !== false) {
				classList += ' skill-item--custom';
			}

			if (skillData.effectType) classList += ` skill-item--effect-${skillData.effectType}`;
			if (isTarget) classList += ' skill-item--target';
			
			const tagsHtml = (skillData.tags || []).map(tag => `<span class="skill-tag">${tag}</span>`).join('');
			const detailsHtml = skillData.evolutionCondition ? `<p><strong>진화/획득 조건:</strong> ${skillData.evolutionCondition}</p>` : '';
			const checkboxClickClass = DB.user.userSettings.clickArea === 'full' ? 'clickable-item' : '';
			
			return `
				<div id="skill-item-${skill.skillId}" class="${classList}" data-skill-id="${skill.skillId}">
					<div class="skill-item__main">
						<div class="skill-info">
							<div><span class="skill-name">${skillData.name}</span>${tagsHtml}</div>
							<div class="skill-source">${sources}</div>
						</div>
						<button class="skill-checkbox ${checkboxClickClass}" data-state="${state}"></button>
					</div>
					${detailsHtml ? `<div class="skill-details">${detailsHtml}</div>` : ''}
				</div>`;
		}).join('');
	}

    function updateTargetProgress(obtainableSkills) {
        const { required = [] } = DB.user.targetSkills || {};
        const progressBar = document.getElementById('target-progress-bar');
        const progressText = document.getElementById('target-progress-text');
        const acquiredCountEl = document.getElementById('acquired-target-count');
        const remainingCountEl = document.getElementById('remaining-target-count');
        const acquiredBubblesEl = document.getElementById('acquired-target-bubbles');
        const remainingBubblesEl = document.getElementById('remaining-target-bubbles');

        if (required.length === 0) {
            progressBar.style.width = '0%';
            progressText.textContent = '목표를 설정해주세요.';
            acquiredBubblesEl.innerHTML = ''; remainingBubblesEl.innerHTML = '';
            acquiredCountEl.textContent = 0; remainingCountEl.textContent = 0;
            return;
        }

        let acquiredCount = 0;
        let acquiredBubblesHTML = '';
        let remainingBubblesHTML = '';
        
        required.forEach(skillId => {
            const skill = getSkillData(skillId);
            if (!skill) return;

            const isObtainable = !!obtainableSkills[skillId];
            const isAcquired = skillCheckStates[skillId] === 2;
            const bubbleClass = isAcquired ? 'acquired' : 'remaining';
            const bubbleHTML = `<div class="target-bubble ${bubbleClass}" data-skill-id="${skillId}" title="${isObtainable ? '획득 가능' : '획득 불가능'}">${skill.name} ${!isObtainable ? '⚠️' : ''}</div>`;
            
            if (isAcquired) {
                acquiredCount++;
                acquiredBubblesHTML += bubbleHTML;
            } else {
                remainingBubblesHTML += bubbleHTML;
            }
        });

        progressBar.style.width = `${(acquiredCount / required.length) * 100}%`;
        progressText.textContent = `달성: ${acquiredCount} / ${required.length}`;
        acquiredCountEl.textContent = acquiredCount;
        remainingCountEl.textContent = required.length - acquiredCount;
        acquiredBubblesEl.innerHTML = acquiredBubblesHTML;
        remainingBubblesEl.innerHTML = remainingBubblesHTML;
    }
    
    // --- 핵심 로직 (획득 가능 스킬 계산) ---
    
	function getObtainableSkills() {
		const skills = {};
		const ignoredSkills = DB.user.targetSkills?.ignored || [];
		
		const addSkill = (skillId, sourceName, type, level = null) => {
			if (!skillId) return;
			const skillData = getSkillData(skillId);
			if (!skillData) {
				console.warn(`존재하지 않는 스킬 ID: ${skillId}`);
				return;
			}

			if (!skills[skillId]) {
				skills[skillId] = { skillId, name: skillData.name, sources: [] };
			}
			skills[skillId].sources.push({ name: sourceName, type, level });
		};
		
		currentDeck.inza.forEach(userInzaId => {
			if (!userInzaId) return;
			const userInza = (DB.user.myCollection.inzaCharacters || []).find(i => i.userInzaId === userInzaId);
			if (!userInza) return;
			
			const masterInza = findMasterInza(userInza.masterInzaId);
			if (!masterInza) return;

			Object.values(masterInza.slots || {}).forEach(slot => {
				if (slot.uniqueSkillId) addSkill(slot.uniqueSkillId, slot.name, '고유');
				
				if (slot.green && slot.green.skillId) {
					addSkill(slot.green.skillId, slot.name, '인자');
				} else if (slot.green && !slot.green.skillId && slot.green.name) {
					const potentialSkill = findSkillByName(slot.green.name);
					if (potentialSkill && potentialSkill.isUnique) {
						addSkill(potentialSkill.skillId, slot.name, '고유(인자)');
					}
				}

				(slot.skillFactors || []).forEach(skillId => addSkill(skillId, slot.name, '인자'));
			});
		});
		
		[...new Set(currentDeck.supportCards.filter(sc => sc))].forEach(userCardId => {
			const userCard = (DB.user.myCollection.supportCards || []).find(c => c.userCardId === userCardId);
			if (!userCard) return;

			const masterCard = findMasterSc(userCard.masterCardId);
			if (!masterCard) return;
			
			const levelInfo = getCardLevelInfo(userCard);

			(masterCard.goldenSkills || []).forEach(gs => (gs.choices || []).forEach(skillId => addSkill(skillId, masterCard.name, '금색')));
			(masterCard.hintSkills || []).forEach(skillId => addSkill(skillId, masterCard.name, '힌트', levelInfo.hintLevel));
			(masterCard.eventSkills || []).forEach(skillId => addSkill(skillId, masterCard.name, '이벤트'));
		});

		if(currentDeck.scenario) {
			const scenarioData = (DB.master.scenarios || []).find(s => s.scenarioId === currentDeck.scenario);
			if(scenarioData) {
				(scenarioData.goldenSkills || []).forEach(gs => (gs.choices || []).forEach(skillId => addSkill(skillId, scenarioData.name, '금색-시나리오')));
				(scenarioData.skills || []).forEach(s => addSkill(s.skillId, scenarioData.name, '시나리오', s.level));
			}
		}
		
		ignoredSkills.forEach(id => delete skills[id]);
		return skills;
	}

    // --- 컬렉션 모달 뷰 템플릿 ---
    function getCollectionMainViewHTML(activeTab) {
        DB.user.userSettings.lastCollectionTab = activeTab;

        const scList = (DB.user.myCollection.supportCards || []).map(card => {
            const levelInfo = getCardLevelInfo(card);
            const masterCard = findMasterSc(card.masterCardId);
            const isCustom = masterCard?.isCustom;
            const prefix = isCustom ? '✏️ ' : '';
            const exportButton = isCustom ? `<button class="export-btn" data-action="export" title="내보내기">📤</button>` : '';

            return `
            <div class="collection-item" data-id="${card.userCardId}" data-type="sc">
                <div class="collection-item-info">
                    <span class="name">${prefix}${card.name}</span>
                    <div class="details">${levelInfo.text}</div>
                </div>
                <div class="collection-item-actions">
                    ${exportButton}
                    <button class="edit-btn" data-action="edit">편집</button>
                    <button class="delete-btn" data-action="delete">삭제</button>
                </div>
            </div>`;
        }).join('') || '<p>보유한 서포트 카드가 없습니다.</p>';

        const inzaList = (DB.user.myCollection.inzaCharacters || []).map(inza => {
            const masterInza = findMasterInza(inza.masterInzaId);
            const isCustom = masterInza?.isCustom;
            const prefix = isCustom ? '✏️ ' : '';
            const actionButton = isCustom 
                ? `<button class="edit-btn" data-action="edit">편집</button>`
                : `<button class="view-btn" data-action="view">보기</button>`;
            const exportButton = isCustom ? `<button class="export-btn" data-action="export" title="내보내기">📤</button>` : '';
            
            return `
            <div class="collection-item" data-id="${inza.userInzaId}" data-type="inza">
                <div class="collection-item-info"><span class="name">${prefix}${inza.name}</span></div>
                <div class="collection-item-actions">
                    ${exportButton}
                    ${actionButton}
                    <button class="delete-btn" data-action="delete">삭제</button>
                </div>
            </div>`;
        }).join('') || '<p>보유한 인자가 없습니다.</p>';

        const customSkillList = (DB.user.customData.skills || []).map(skill => `
             <div class="collection-item" data-id="${skill.skillId}" data-type="customSkill">
                <div class="collection-item-info">
                    <span class="name">✏️ ${skill.name}</span>
                    <div class="details">타입: ${skill.effectType || '일반'}, 카테고리: ${skill.category || '공용'}, 태그: ${(skill.tags || []).join(', ') || '없음'}</div>
                </div>
                <div class="collection-item-actions">
                    <button class="export-btn" data-action="export" title="내보내기">📤</button>
                    <button class="edit-btn" data-action="edit">편집</button>
                    <button class="delete-btn" data-action="delete">삭제</button>
                </div>
            </div>
        `).join('') || '<p>생성된 커스텀 스킬이 없습니다.</p>';

        let listContent = '';
        if (activeTab === 'sc') listContent = scList;
        else if (activeTab === 'inza') listContent = inzaList;
        else if (activeTab === 'customSkill') listContent = customSkillList;

        const actionButtonText = activeTab === 'customSkill' ? '✚ 새 커스텀 스킬 생성' : `✚ 직접 생성`;
        const addMasterButton = activeTab !== 'customSkill' ? `<button class="action-btn" data-action="addMaster">✚ 기존 ${activeTab === 'sc' ? '카드' : '인자'}에서 추가</button>` : '';

        return `
            <div class="collection-header">
                <div class="collection-tabs">
                    <button class="tab-btn ${activeTab === 'sc' ? 'active' : ''}" data-tab="sc">서포트 카드</button>
                    <button class="tab-btn ${activeTab === 'inza' ? 'active' : ''}" data-tab="inza">인자</button>
                    <button class="tab-btn ${activeTab === 'customSkill' ? 'active' : ''}" data-tab="customSkill">커스텀 스킬</button>
                </div>
            </div>
            <div class="collection-main">
                <div class="collection-actions">
                    ${addMasterButton}
                    <button class="action-btn" data-action="addCustom">${actionButtonText}</button>
                    <button class="action-btn" id="import-data-btn" data-action="import-individual">📥 개별 데이터 가져오기</button>
                </div>
                <div class="collection-list">${listContent}</div>
            </div>`;
    }

    function getEditMasterScViewHTML(cardData) {
        const levelOptions = [
            {val: 4, text: "4돌파 (풀돌)"}, {val: 3, text: "3돌파"}, {val: 2, text: "2돌파"}, {val: 1, text: "1돌파"}, {val: 0, text: "0돌파 (명함)"}
        ].map(o => `<option value="${o.val}" ${cardData.level == o.val ? 'selected' : ''}>${o.text}</option>`).join('');

        return `
             <form class="collection-form-view" data-editing-id="${cardData.userCardId}">
                <h3>기존 서포트 카드 편집</h3>
                <div class="form-grid">
                    <div class="form-field">
                        <label for="master-sc-name">카드 이름</label>
                        <input type="text" id="master-sc-name" value="${cardData.name}" disabled>
                    </div>
                    <div class="form-field">
                        <label for="master-sc-level">돌파 레벨</label>
                        <select id="master-sc-level" required>${levelOptions}</select>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="cancel-btn">취소</button>
                    <button type="submit" class="save-btn">저장</button>
                </div>
            </form>
        `;
    }

    function getAddMasterInzaViewHTML() {
        return `
            <form class="collection-form-view inza-search-form">
                <h3>기존 인자에서 추가</h3>
                <div class="form-grid">
                    <div class="form-field">
                        <label for="master-inza-search">인자 이름 검색</label>
                        <input type="text" id="master-inza-search" placeholder="마스터 인자 이름을 입력하세요...">
                    </div>
                </div>
                <div class="inza-search-results"></div>
                <div class="form-actions">
                    <button type="button" class="cancel-btn">취소</button>
                    <button type="submit" class="save-btn" disabled>컬렉션에 추가</button>
                </div>
            </form>
        `;
    }

    function getCustomScViewHTML(cardData = null, isEdit = false) {
        const hintOptions = [5,4,3,2,1].map(o => `<option value="${o}" ${cardData?.hintLevel == o ? 'selected' : ''}>${o}레벨</option>`).join('');
        const allSkills = [...DB.master.skills, ...(DB.user.customData.skills || [])];
        
        const getSkillNames = (skillIds) => (skillIds || []).map(id => allSkills.find(s => s.skillId === id)?.name).filter(Boolean).join('\n');
        
        const hintSkillsText = getSkillNames(cardData?.hintSkills);
        const eventSkillsText = getSkillNames(cardData?.eventSkills);

        return `
            <form class="collection-form-view" data-editing-id="${isEdit ? cardData.masterCardId : ''}">
                <h3>${isEdit ? '커스텀 서포트 카드 편집' : '커스텀 서포트 카드 생성'}</h3>
                <div class="form-grid">
                    <div class="form-field">
                        <label for="custom-sc-name">카드 이름</label>
                        <input type="text" id="custom-sc-name" required placeholder="예: 나의 최강 엘콘" value="${cardData?.name || ''}">
                    </div>
                    <div class="form-field">
                        <label for="custom-sc-hint-level">힌트 레벨</label>
                        <select id="custom-sc-hint-level">${hintOptions}</select>
                    </div>
                    <div class="form-field">
                        <label for="custom-sc-hint-skills">힌트 스킬 목록</label>
                        <textarea id="custom-sc-hint-skills" rows="4" placeholder="직접 입력하거나 아래 버튼으로 검색">${hintSkillsText}</textarea>
                        <button type="button" class="skill-search-btn">스킬 검색</button>
                    </div>
                    <div class="form-field">
                        <label for="custom-sc-event-skills">이벤트 획득 스킬 목록</label>
                        <textarea id="custom-sc-event-skills" rows="4" placeholder="직접 입력하거나 아래 버튼으로 검색">${eventSkillsText}</textarea>
                        <button type="button" class="skill-search-btn">스킬 검색</button>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="cancel-btn">취소</button>
                    <button type="submit" class="save-btn">저장</button>
                </div>
            </form>`;
    }
    
    function getInzaViewHTML(inzaData, isViewOnly = false) {
        const factorTypes = {
            blue: ['스피드', '스태미나', '파워', '근성', '지능'],
            red: ['더트', '단거리', '마일', '중거리', '장거리', '도주', '선행', '선입', '추입'],
            star: [3, 2, 1]
        };
        const slots = ['parent', 'grandparent1', 'grandparent2'];
        const slotNames = {'parent': '부모', 'grandparent1': '조부모 1', 'grandparent2': '조부모 2'};
        const allSkills = [...DB.master.skills, ...(DB.user.customData.skills || [])];
        const disabledAttr = isViewOnly ? 'disabled' : '';

        const getSkillNames = (skillIds) => (skillIds || []).map(id => allSkills.find(s => s.skillId === id)?.name).filter(Boolean).join('\n');

        const slotForms = slots.map(slotId => {
            const slotData = inzaData?.slots?.[slotId] || {};
            const greenSkillName = getSkillData(slotData.green?.skillId)?.name || slotData.green?.name || '';

            return `
            <div class="inza-slot-form">
                <h4>${slotNames[slotId]} 슬롯</h4>
                <div class="form-grid">
                    <div class="form-field">
                        <label for="inza-char-name-${slotId}">캐릭터 이름</label>
                        <input type="text" id="inza-char-name-${slotId}" placeholder="예: 키타산 블랙" value="${slotData.name || ''}" ${disabledAttr}>
                    </div>
                    <div class="factor-grid">
                        <div class="form-field">
                            <label>청인자</label>
                            <select id="inza-blue-type-${slotId}" ${disabledAttr}><option value="">-타입-</option>${factorTypes.blue.map(t=>`<option value="${t}" ${slotData.blue?.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
                            <select id="inza-blue-star-${slotId}" ${disabledAttr}><option value="">-★-</option>${factorTypes.star.map(s=>`<option value="${s}" ${slotData.blue?.star == s ? 'selected' : ''}>${s}</option>`).join('')}</select>
                        </div>
                        <div class="form-field">
                            <label>적인자</label>
                            <select id="inza-red-type-${slotId}" ${disabledAttr}><option value="">-타입-</option>${factorTypes.red.map(t=>`<option value="${t}" ${slotData.red?.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
                            <select id="inza-red-star-${slotId}" ${disabledAttr}><option value="">-★-</option>${factorTypes.star.map(s=>`<option value="${s}" ${slotData.red?.star == s ? 'selected' : ''}>${s}</option>`).join('')}</select>
                        </div>
                        <div class="form-field">
                            <label>녹인자 (선택)</label>
                            <input type="text" id="inza-green-skill-${slotId}" placeholder="스킬명" value="${greenSkillName}" ${disabledAttr}>
                            <select id="inza-green-star-${slotId}" ${disabledAttr}><option value="">-★-</option>${factorTypes.star.map(s=>`<option value="${s}" ${slotData.green?.star == s ? 'selected' : ''}>${s}</option>`).join('')}</select>
                        </div>
                    </div>
                    <div class="form-field">
                        <label for="inza-skills-${slotId}">스킬 인자 목록</label>
                        <textarea id="inza-skills-${slotId}" rows="3" placeholder="직접 입력하거나 아래 버튼으로 검색" ${isViewOnly ? 'readonly' : ''}>${getSkillNames(slotData.skillFactors)}</textarea>
                        ${!isViewOnly ? `<button type="button" class="skill-search-btn">스킬 검색</button>` : ''}
                    </div>
                </div>
            </div>
        `}).join('');

        const title = isViewOnly ? '마스터 인자 상세 보기' : (inzaData ? '커스텀 인자 세트 편집' : '커스텀 인자 세트 생성');
        const saveButton = !isViewOnly ? `<button type="submit" class="save-btn">저장</button>` : '';

        return `
             <form class="collection-form-view inza-custom-form" data-editing-id="${inzaData?.masterInzaId || ''}">
                <h3>${title}</h3>
                 <div class="form-field">
                    <label for="custom-inza-set-name">인자 세트 이름</label>
                    <input type="text" id="custom-inza-set-name" required placeholder="예: 나의 결전용 보드카 인자" value="${inzaData?.name || ''}" ${disabledAttr}>
                </div>
                ${slotForms}
                <div class="form-actions">
                    <button type="button" class="cancel-btn">${isViewOnly ? '닫기' : '취소'}</button>
                    ${saveButton}
                </div>
            </form>
        `;
    }

	function getCustomSkillFormHTML(skillData = null) {
		const isEdit = !!skillData;
		const effectTypes = { normal: '일반', passive: '패시브/능력치 (녹색)', heal: '회복 (파랑)', debuff: '디버프/방해 (빨강)' };
		const categories = { common: '공용 (특정 조건 없음)', distance: '거리 (단/마/중/장거리)', style: '각질 (도주/선행 등)' };
		const upgradeTypes = { normal: '일반 스킬', gold: '상위 스킬 (금색)', evolved: '진화 스킬 (핑크)' };

		const showHighlightChecked = isEdit ? (skillData.showCustomHighlight !== false ? 'checked' : '') : '';

		return `
			<form class="collection-form-view" data-editing-id="${isEdit ? skillData.skillId : ''}">
				<h3>${isEdit ? '커스텀 스킬 편집' : '새 커스텀 스킬 생성'}</h3>
				
				<div class="form-field">
					<label for="custom-skill-name">스킬 이름</label>
					<input type="text" id="custom-skill-name" required value="${skillData?.name || ''}">
				</div>
				<div class="form-field">
					<label><input type="checkbox" id="custom-skill-isUnique" ${skillData?.isUnique ? 'checked' : ''}> 캐릭터 고유 스킬</label>
				</div>

				<div class="form-grid form-grid-cols-2">
					<div class="form-field">
						<label for="custom-skill-upgradeType">스킬 등급</label>
						<select id="custom-skill-upgradeType">
							${Object.entries(upgradeTypes).map(([key, value]) => `<option value="${key}" ${skillData?.upgradeType === key ? 'selected' : ''}>${value}</option>`).join('')}
						</select>
					</div>

					<div class="form-field">
						<label for="custom-skill-effectType">아이콘 색상 (효과)</label>
						<select id="custom-skill-effectType">
							${Object.entries(effectTypes).map(([key, value]) => `<option value="${key}" ${skillData?.effectType === key ? 'selected' : ''}>${value}</option>`).join('')}
						</select>
					</div>
					
					<div class="form-field">
						<label for="custom-skill-category">목록에 표시할 그룹</label>
						<select id="custom-skill-category">
							 ${Object.entries(categories).map(([key, value]) => `<option value="${key}" ${skillData?.category === key ? 'selected' : ''}>${value}</option>`).join('')}
						</select>
						<small>💡 스킬 목록을 정리할 폴더를 선택합니다.</small>
					</div>
					
					<div class="form-field">
						<label for="custom-skill-tags">스킬 정보 태그 (쉼표로 구분)</label>
						<input type="text" id="custom-skill-tags" placeholder="예: 중거리, 선행, 최종 코너" value="${(skillData?.tags || []).join(', ')}">
						<small>💡 스킬의 모든 조건, 특징을 입력합니다.</small>
					</div>
				</div>

				<div class="form-field conditional-field" style="display: ${skillData?.upgradeType === 'evolved' ? 'flex' : 'none'};">
					<label for="custom-skill-condition">진화 조건</label>
					<textarea id="custom-skill-condition" rows="2" placeholder="예: G1 4회 이상 승리 및 스피드 1200 이상 달성 시">${skillData?.evolutionCondition || ''}</textarea>
				</div>

				<hr style="border-color: var(--border-color); border-style: dashed; margin: 15px 0;">

				<div class="form-field">
					<label><input type="checkbox" id="custom-skill-show-highlight" ${showHighlightChecked}> ✏️ 커스텀 배경 표시 (하늘색)</label>
				</div>

				<div class="form-actions">
					<button type="button" class="cancel-btn">취소</button>
					<button type="submit" class="save-btn">저장</button>
				</div>
			</form>
		`;
	}

    // --- 스킬 검색 모달 로직 ---
    let currentSkillTextarea = null;
    let skillSearchSelectedIds = new Set();
    
    function openSkillSearchModal(textareaElement) {
        currentSkillTextarea = textareaElement;
        const existingSkillNames = textareaElement.value.split('\n').map(s => s.trim()).filter(Boolean);
        const allSkills = [...DB.master.skills, ...(DB.user.customData.skills || [])];
        
        skillSearchSelectedIds.clear();
        existingSkillNames.forEach(name => {
            const skill = allSkills.find(s => s.name === name);
            if (skill) skillSearchSelectedIds.add(skill.skillId);
        });

        renderSkillSearchModal();
        skillSearchModal.style.display = 'flex';
        document.getElementById('skill-search-input').focus();
    }

    function renderSkillSearchModal(searchTerm = '') {
        const allSkills = [...DB.master.skills, ...(DB.user.customData.skills || [])].sort((a,b) => a.name.localeCompare(b.name, 'ko'));
        const searchInput = document.getElementById('skill-search-input');
        const allSkillsListEl = skillSearchModal.querySelector('#skill-search-all-skills .skill-list');
        const selectedSkillsListEl = skillSearchModal.querySelector('#skill-search-selected-skills .skill-list');
        const selectedCountEl = document.getElementById('skill-search-count');

        const lowercasedTerm = searchTerm.toLowerCase();
        const filteredSkills = searchTerm 
            ? allSkills.filter(s => s.name.toLowerCase().includes(lowercasedTerm))
            : allSkills;
            
        allSkillsListEl.innerHTML = filteredSkills.map(s => {
            const prefix = s.isCustom ? '✏️ ' : '';
            return `
            <div class="modal-skill-item ${skillSearchSelectedIds.has(s.skillId) ? 'selected' : ''}" data-skill-id="${s.skillId}">
                <span>${prefix}${s.name}</span>
                <div class="actions">
                    <button data-action="add-skill">${skillSearchSelectedIds.has(s.skillId) ? '✓' : '+'}</button>
                </div>
            </div>
        `}).join('');
        
        selectedSkillsListEl.innerHTML = [...skillSearchSelectedIds].map(id => {
            const skill = allSkills.find(s => s.skillId === id);
            return skill ? `
                <div class="modal-skill-item" data-id="${id}">
                    <span>${skill.isCustom ? '✏️ ' : ''}${skill.name}</span>
                    <div class="actions"><button data-action="remove-skill" data-id="${id}">-</button></div>
                </div>` : '';
        }).join('') || '<p>선택된 스킬이 없습니다.</p>';
        
        selectedCountEl.textContent = skillSearchSelectedIds.size;
        if(document.activeElement !== searchInput) searchInput.value = searchTerm;
    }
    
    function handleSkillSearchModalClick(e) {
        const target = e.target;
        const skillItem = target.closest('.modal-skill-item');
        if (!skillItem) return;
        
        const skillId = skillItem.dataset.skillId || skillItem.dataset.id;
        const action = target.dataset.action;

        if (action === 'add-skill' || (!action && target.tagName !== 'BUTTON')) {
            if (skillSearchSelectedIds.has(skillId)) {
                skillSearchSelectedIds.delete(skillId);
            } else {
                skillSearchSelectedIds.add(skillId);
            }
        } else if (action === 'remove-skill') {
            skillSearchSelectedIds.delete(skillId);
        }
        
        renderSkillSearchModal(document.getElementById('skill-search-input').value);
    }
    
    // --- 컬렉션 관리 로직 ---
    function renderCollectionView(viewName, params = {}) {
        let html = '';
        switch(viewName) {
            case 'main': html = getCollectionMainViewHTML(params.activeTab || 'sc'); break;
            case 'editMasterSc': html = getEditMasterScViewHTML(params.data); break;
            case 'addMasterInza': html = getAddMasterInzaViewHTML(); break;
            case 'viewMasterInza': html = getInzaViewHTML(params.data, true); break;
            case 'addCustomSc': html = getCustomScViewHTML(params.data, !!params.data); break;
            case 'addCustomInza': html = getInzaViewHTML(params.data, false); break;
            case 'addCustomSkill': html = getCustomSkillFormHTML(params.data); break;
        }
        collectionViewContainer.innerHTML = html;
        addCollectionEventListeners(viewName);
    }
    
    let selectedMasterInzaId = null;
    function addCollectionEventListeners(viewName) {
        const container = collectionViewContainer;
        if (viewName === 'main') {
            container.querySelector('.collection-tabs')?.addEventListener('click', e => {
                if (e.target.matches('.tab-btn')) renderCollectionView('main', { activeTab: e.target.dataset.tab });
            });
            container.querySelector('.collection-actions')?.addEventListener('click', e => {
                const activeTab = DB.user.userSettings.lastCollectionTab;
                if (e.target.matches('[data-action="addMaster"]')) {
                    if(activeTab === 'sc') renderCollectionView('editMasterSc', { data: null });
                    else renderCollectionView('addMasterInza');
                } else if (e.target.matches('[data-action="addCustom"]')) {
                    if(activeTab === 'sc') renderCollectionView('addCustomSc');
                    else if(activeTab === 'inza') renderCollectionView('addCustomInza');
                    else if(activeTab === 'customSkill') renderCollectionView('addCustomSkill');
                } else if (e.target.matches('[data-action="import-individual"]')) {
                    importJsonInput.click();
                }
            });
            container.querySelector('.collection-list')?.addEventListener('click', e => {
                const action = e.target.dataset.action;
                if(action === 'delete') handleDeleteCollectionItem(e.target);
                else if(action === 'edit' || action === 'view') handleEditOrViewCollectionItem(e.target);
                else if(action === 'export') handleExportCollectionItem(e.target);
            });
        } else {
            const form = container.querySelector('form');
            if(form) {
                form.addEventListener('submit', e => {
                    e.preventDefault();
                    if (viewName === 'editMasterSc') handleSaveMasterSc(form);
                    else if (viewName === 'addMasterInza') handleSaveMasterInza(form);
                    else if (viewName === 'addCustomSc') handleSaveCustomSc(form);
                    else if (viewName === 'addCustomInza') handleSaveCustomInza(form);
                    else if (viewName === 'addCustomSkill') handleSaveCustomSkill(form);
                });
            }
            container.querySelector('.cancel-btn')?.addEventListener('click', () => {
                 renderCollectionView('main', { activeTab: DB.user.userSettings.lastCollectionTab });
            });

            if (viewName === 'addMasterInza') {
                const searchInput = form.querySelector('#master-inza-search');
                const resultsContainer = form.querySelector('.inza-search-results');
                const saveBtn = form.querySelector('.save-btn');
                
                searchInput.addEventListener('input', () => {
                    const term = searchInput.value.toLowerCase();
                    resultsContainer.innerHTML = '';
                    saveBtn.disabled = true;
                    selectedMasterInzaId = null;
                    if (!term) return;
                    
                    const results = DB.master.inzaCharacters.filter(i => i.name.toLowerCase().includes(term));
                    resultsContainer.innerHTML = results.map(i => `<div class="inza-search-item" data-id="${i.masterInzaId}">${i.name}</div>`).join('');
                });

                resultsContainer.addEventListener('click', e => {
                    if (e.target.matches('.inza-search-item')) {
                        selectedMasterInzaId = e.target.dataset.id;
                        searchInput.value = e.target.textContent;
                        saveBtn.disabled = false;
                        resultsContainer.innerHTML = '';
                    }
                });
            } else if (viewName === 'addCustomSc' || viewName === 'addCustomInza') {
                container.querySelectorAll('.skill-search-btn').forEach(btn => {
                    btn.addEventListener('click', e => {
                        const textarea = e.target.previousElementSibling;
                        openSkillSearchModal(textarea, (confirmedSkillIds) => {
                            const allSkills = [...DB.master.skills, ...(DB.user.customData.skills || [])];
                            textarea.value = [...confirmedSkillIds].map(id => allSkills.find(s => s.skillId === id)?.name).filter(Boolean).join('\n');
                        });
                    });
                });
            } else if (viewName === 'addCustomSkill') {
                const upgradeTypeSelect = form.querySelector('#custom-skill-upgradeType');
                const conditionField = form.querySelector('.conditional-field');
                upgradeTypeSelect.addEventListener('change', () => {
                    conditionField.style.display = upgradeTypeSelect.value === 'evolved' ? 'flex' : 'none';
                });
            }
        }
    }
    
    function handleSaveMasterSc(form) {
        const editingId = form.dataset.editingId;
        const level = parseInt(form.querySelector('#master-sc-level').value, 10);
        
        if (editingId) {
            const userCard = DB.user.myCollection.supportCards.find(c => c.userCardId === editingId);
            if(userCard) userCard.level = level;
        } 
        saveUserData();
        renderCollectionView('main', { activeTab: 'sc' });
    }

    function handleSaveMasterInza(form) {
        if (!selectedMasterInzaId) { alert('인자를 선택해주세요.'); return; }
        const masterInza = DB.master.inzaCharacters.find(i => i.masterInzaId === selectedMasterInzaId);
        if(!masterInza) { alert('유효하지 않은 마스터 인자입니다.'); return; }

        const newUserInza = { userInzaId: `user_inza_${Date.now()}`, masterInzaId: masterInza.masterInzaId, name: masterInza.name };
        DB.user.myCollection.inzaCharacters.push(newUserInza);
        
        saveUserData();
        selectedMasterInzaId = null;
        renderCollectionView('main', { activeTab: 'inza' });
    }
    
    function processSkillTextarea(textarea) {
        const skillNames = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
        const validSkillIds = [];
        const notFoundSkillNames = [];

        skillNames.forEach(name => {
            const skill = findSkillByName(name);
            if (skill) {
                validSkillIds.push(skill.skillId);
            } else {
                notFoundSkillNames.push(name);
            }
        });
        return { validSkillIds, notFoundSkillNames };
    }

    function handleSaveCustomSc(form) {
        const name = form.querySelector('#custom-sc-name').value.trim();
        if (!name) { alert('카드 이름을 입력해주세요.'); return; }
        
        const editingId = form.dataset.editingId;
        const hintLevel = parseInt(form.querySelector('#custom-sc-hint-level').value, 10);
        
        const hintResult = processSkillTextarea(form.querySelector('#custom-sc-hint-skills'));
        const eventResult = processSkillTextarea(form.querySelector('#custom-sc-event-skills'));

        const allNotFound = [...hintResult.notFoundSkillNames, ...eventResult.notFoundSkillNames];
        
        if(editingId) {
            const masterCard = DB.user.customData.supportCards.find(c => c.masterCardId === editingId);
            if (masterCard) {
                masterCard.name = name;
                masterCard.hintLevel = hintLevel;
                masterCard.hintSkills = hintResult.validSkillIds;
                masterCard.eventSkills = eventResult.validSkillIds;
                
                DB.user.myCollection.supportCards.forEach(uc => {
                    if (uc.masterCardId === masterCard.masterCardId) uc.name = name;
                });
            }
        } else {
            const masterCardId = `custom_sc_${Date.now()}`;
            const newMasterCard = {
                masterCardId, name, hintLevel, isCustom: true,
                hintSkills: hintResult.validSkillIds, eventSkills: eventResult.validSkillIds,
            };
            DB.user.customData.supportCards.push(newMasterCard);

            const newUserCard = { userCardId: `user_sc_${Date.now()}`, masterCardId, name, level: 4, hintLevel };
            DB.user.myCollection.supportCards.push(newUserCard);
        }
        
        saveUserData();
        renderCollectionView('main', { activeTab: 'sc' });
        
        if (allNotFound.length > 0) {
            alert(`저장이 완료되었습니다.\n\n단, 다음 스킬은 DB에 없어 제외되었습니다:\n- ${allNotFound.join('\n- ')}\n\n커스텀 스킬 탭에서 먼저 생성해주세요.`);
        }
    }
    
    function handleSaveCustomInza(form) {
        const setName = form.querySelector('#custom-inza-set-name').value.trim();
        if (!setName) { alert('인자 세트 이름을 입력해주세요.'); return; }

        const editingId = form.dataset.editingId;
        const slots = ['parent', 'grandparent1', 'grandparent2'];
        const newSlots = {};
        const allNotFound = [];

        slots.forEach(slotId => {
            const charName = form.querySelector(`#inza-char-name-${slotId}`).value.trim();
            const skillResult = processSkillTextarea(form.querySelector(`#inza-skills-${slotId}`));
            if (skillResult.notFoundSkillNames.length > 0) allNotFound.push(...skillResult.notFoundSkillNames);
            
            newSlots[slotId] = { name: charName, skillFactors: skillResult.validSkillIds };
            
            const blueType = form.querySelector(`#inza-blue-type-${slotId}`).value;
            const blueStar = form.querySelector(`#inza-blue-star-${slotId}`).value;
            if (blueType && blueStar) newSlots[slotId].blue = { type: blueType, star: parseInt(blueStar) };
            
            const redType = form.querySelector(`#inza-red-type-${slotId}`).value;
            const redStar = form.querySelector(`#inza-red-star-${slotId}`).value;
            if (redType && redStar) newSlots[slotId].red = { type: redType, star: parseInt(redStar) };
            
            const greenSkillName = form.querySelector(`#inza-green-skill-${slotId}`).value.trim();
            const greenStar = form.querySelector(`#inza-green-star-${slotId}`).value;
            if (greenSkillName && greenStar) {
                const greenSkill = findSkillByName(greenSkillName);
                if (greenSkill) {
                    newSlots[slotId].green = { skillId: greenSkill.skillId, name: greenSkill.name, star: parseInt(greenStar) };
                } else {
                    newSlots[slotId].green = { skillId: null, name: greenSkillName, star: parseInt(greenStar) };
                }
            }
        });

        if (editingId) {
             const masterInza = DB.user.customData.inzaCharacters.find(i => i.masterInzaId === editingId);
             if (masterInza) {
                masterInza.name = setName;
                masterInza.slots = newSlots;
                DB.user.myCollection.inzaCharacters.forEach(ui => {
                    if (ui.masterInzaId === masterInza.masterInzaId) ui.name = setName;
                });
             }
        } else {
            const masterInzaId = `custom_inza_${Date.now()}`;
            const newMasterInza = { masterInzaId, name: setName, slots: newSlots, isCustom: true };
            DB.user.customData.inzaCharacters.push(newMasterInza);
            
            const newUserInza = { userInzaId: `user_inza_${Date.now()}`, masterInzaId, name: setName };
            DB.user.myCollection.inzaCharacters.push(newUserInza);
        }

        saveUserData();
        renderCollectionView('main', { activeTab: 'inza' });

        if (allNotFound.length > 0) {
            alert(`저장이 완료되었습니다.\n\n단, 다음 스킬 인자는 DB에 없어 제외되었습니다:\n- ${[...new Set(allNotFound)].join('\n- ')}\n\n커스텀 스킬 탭에서 먼저 생성해주세요.`);
        }
    }
	
	function handleSaveCustomSkill(form) {
		const name = form.querySelector('#custom-skill-name').value.trim();
		if (!name) { alert('스킬 이름을 입력해주세요.'); return; }

		const editingId = form.dataset.editingId;
		
		const isUnique = form.querySelector('#custom-skill-isUnique').checked;
		const upgradeType = form.querySelector('#custom-skill-upgradeType').value;
		const evolutionCondition = form.querySelector('#custom-skill-condition').value.trim();
		const effectType = form.querySelector('#custom-skill-effectType').value;
		const category = form.querySelector('#custom-skill-category').value;
		const tags = form.querySelector('#custom-skill-tags').value.split(',').map(t => t.trim()).filter(Boolean);
		const showCustomHighlight = form.querySelector('#custom-skill-show-highlight').checked;

		const newSkillData = { 
			name, 
			isUnique,
			upgradeType,
			evolutionCondition: (upgradeType === 'evolved' && evolutionCondition) ? evolutionCondition : null,
			effectType, 
			category, 
			tags,
			showCustomHighlight,
			isCustom: true 
		};

		const existingSkill = (DB.master.skills.find(s => s.name === name) || DB.user.customData.skills.find(s => s.name === name && s.skillId !== editingId));
		if (existingSkill) {
			alert(`오류: 이미 '${name}'이라는 이름의 스킬이 존재합니다.`);
			return;
		}

		if (editingId) {
			const skillIndex = DB.user.customData.skills.findIndex(s => s.skillId === editingId);
			if (skillIndex > -1) {
				DB.user.customData.skills[skillIndex] = { ...DB.user.customData.skills[skillIndex], ...newSkillData };
			}
		} else {
			const newSkillId = `custom_s_${Date.now()}`;
			DB.user.customData.skills.push({ skillId: newSkillId, ...newSkillData });
		}
		
		saveUserData();
		renderCollectionView('main', { activeTab: 'customSkill' });
	}
    
    function handleDeleteCollectionItem(btn) {
        const itemEl = btn.closest('.collection-item');
        const id = itemEl.dataset.id;
        const type = itemEl.dataset.type;

        if (type === 'customSkill') {
             const skillToDelete = DB.user.customData.skills.find(s => s.skillId === id);
             if (!skillToDelete) return;
             
             const dependentCards = (DB.user.customData.supportCards || []).filter(c => 
                (c.hintSkills || []).includes(id) || (c.eventSkills || []).includes(id)
             ).map(c => c.name);
             
             const dependentInzas = (DB.user.customData.inzaCharacters || []).filter(inza =>
                Object.values(inza.slots).some(slot => (slot.skillFactors || []).includes(id) || slot.green?.skillId === id)
             ).map(i => i.name);
             
             let confirmMsg = `⚠️ 경고!\n'${skillToDelete.name}' 스킬을 삭제하시겠습니까?`;
             if (dependentCards.length > 0 || dependentInzas.length > 0) {
                 confirmMsg += `\n\n이 스킬을 사용하는 아래의 커스텀 데이터에서 해당 스킬이 함께 제거됩니다.`;
                 if (dependentCards.length > 0) confirmMsg += `\n- 카드: ${dependentCards.join(', ')}`;
                 if (dependentInzas.length > 0) confirmMsg += `\n- 인자: ${dependentInzas.join(', ')}`;
             }
             
             if (confirm(confirmMsg)) {
                DB.user.customData.skills = (DB.user.customData.skills || []).filter(s => s.skillId !== id);
                
                (DB.user.customData.supportCards || []).forEach(card => {
                    card.hintSkills = (card.hintSkills || []).filter(sid => sid !== id);
                    card.eventSkills = (card.eventSkills || []).filter(sid => sid !== id);
                });
                (DB.user.customData.inzaCharacters || []).forEach(inza => {
                    Object.values(inza.slots).forEach(slot => {
                        slot.skillFactors = (slot.skillFactors || []).filter(sid => sid !== id);
                        if (slot.green?.skillId === id) delete slot.green;
                    });
                });

                saveUserData();
                renderCollectionView('main', { activeTab: 'customSkill' });
            }
        } else if (confirm('정말로 이 항목을 컬렉션에서 삭제하시겠습니까? (커스텀 원본 데이터는 삭제되지 않습니다)')) {
            if (type === 'sc') {
                DB.user.myCollection.supportCards = (DB.user.myCollection.supportCards || []).filter(c => c.userCardId !== id);
            } else if (type === 'inza') {
                DB.user.myCollection.inzaCharacters = (DB.user.myCollection.inzaCharacters || []).filter(i => i.userInzaId !== id);
            }
            saveUserData();
            renderCollectionView('main', { activeTab: type });
        }
    }

    function handleEditOrViewCollectionItem(btn) {
        const itemEl = btn.closest('.collection-item');
        const id = itemEl.dataset.id;
        const type = itemEl.dataset.type;

        if (type === 'sc') {
            const userCard = DB.user.myCollection.supportCards.find(c => c.userCardId === id);
            if (!userCard) return;
            const masterCard = findMasterSc(userCard.masterCardId);
            
            if (masterCard.isCustom) {
                renderCollectionView('addCustomSc', { data: masterCard });
            } else {
                renderCollectionView('editMasterSc', { data: userCard });
            }
        } else if (type === 'inza') {
            const userInza = DB.user.myCollection.inzaCharacters.find(i => i.userInzaId === id);
            if (!userInza) return;
            const masterInza = findMasterInza(userInza.masterInzaId);
            
            if (masterInza.isCustom) {
                 renderCollectionView('addCustomInza', { data: masterInza });
            } else {
                 renderCollectionView('viewMasterInza', { data: masterInza });
            }
        } else if (type === 'customSkill') {
            const skill = DB.user.customData.skills.find(s => s.skillId === id);
            if(skill) renderCollectionView('addCustomSkill', { data: skill });
        }
    }

    // --- 이벤트 핸들러 ---
    function handleDeckChange() {
        currentDeck.scenario = scenarioSelect.value || null;
        inzaSelects.forEach((s, i) => currentDeck.inza[i] = s.value || null);
        scSelects.forEach((s, i) => currentDeck.supportCards[i] = s.value || null);
        
        populateSelectors();
        const obtainableSkills = getObtainableSkills();
        renderSkillList(obtainableSkills);
        updateTargetProgress(obtainableSkills);
        saveUserData();
    }
    
    function handleSkillItemClick(e) {
        let targetElement = e.target;
        const clickArea = DB.user.userSettings.clickArea;

        if (clickArea === 'full') {
            const skillItem = targetElement.closest('.skill-item');
            if (skillItem) {
                targetElement = skillItem.querySelector('.skill-checkbox');
            } else { return; }
        }

        if (targetElement && targetElement.classList.contains('skill-checkbox')) {
            const skillId = targetElement.closest('.skill-item').dataset.skillId;
            const currentState = parseInt(targetElement.dataset.state, 10);
            skillCheckStates[skillId] = (currentState + 1) % 3;
            renderAll();
            saveUserData();
        }
    }
    
    function handleResetClick() {
        if (confirm('모든 스킬 체크 상태를 초기화하시겠습니까?')) {
            skillCheckStates = {};
            renderAll();
            saveUserData();
        }
    }
    
    function handleResetDataClick() {
        if (confirm('⚠️ 경고! 저장된 덱, 컬렉션, 목표 등 모든 사용자 데이터가 초기화됩니다. 계속하시겠습니까?')) {
            localStorage.removeItem(USER_DB_KEY);
            window.location.reload();
        }
    }
    
    function handleUploadChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                if (jsonData.myCollection && jsonData.userSettings) {
                    applyUserData(jsonData);
                    saveUserData();
                    renderAll();
                    alert('전체 데이터를 성공적으로 불러왔습니다.');
                } else {
                    throw new Error('유효하지 않은 전체 데이터 파일 형식입니다.');
                }
            } catch (err) {
                console.error("파일 업로드 처리 오류:", err);
                alert(`오류: ${err.message}`);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function toggleTheme() {
        const newTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        DB.user.userSettings.theme = newTheme;
        saveUserData();
    }

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    function applyDetailsVisibility(visible) {
        skillListContainer.classList.toggle('details-visible', visible);
    }

    function handleTargetBubbleClick(e) {
        if (e.target.matches('.target-bubble')) {
            const skillId = e.target.dataset.skillId;
            const skillItem = document.getElementById(`skill-item-${skillId}`);
            if (skillItem) {
                skillItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                skillItem.classList.add('highlight-scroll');
                setTimeout(() => {
                    skillItem.classList.remove('highlight-scroll');
                }, 1500);
            }
        }
    }

    function handleTargetModalEvents(e) {
        const action = e.target.dataset.action;
        if (!action) return;

        const id = e.target.closest('.modal-skill-item').dataset.id;
        const { required = [], ignored = [] } = DB.user.targetSkills;

        if (action === 'add-required') {
            DB.user.targetSkills.required = [...new Set([...required, id])];
            DB.user.targetSkills.ignored = ignored.filter(skillId => skillId !== id);
        } else if (action === 'add-ignored') {
            DB.user.targetSkills.ignored = [...new Set([...ignored, id])];
            DB.user.targetSkills.required = required.filter(skillId => skillId !== id);
        } else if (action === 'remove-required') {
            DB.user.targetSkills.required = required.filter(skillId => skillId !== id);
        } else if (action === 'remove-ignored') {
            DB.user.targetSkills.ignored = ignored.filter(skillId => skillId !== id);
        }
        renderTargetModalContent(document.getElementById('modal-search').value);
    }

    function renderTargetModalContent(searchTerm = '') {
        const allSkillsListEl = targetModal.querySelector('#modal-all-skills .skill-list');
        const requiredListEl = targetModal.querySelector('#modal-required-skills .skill-list');
        const ignoredListEl = targetModal.querySelector('#modal-ignored-skills .skill-list');

        const { required = [], ignored = [] } = DB.user.targetSkills;
        const allSkills = [...(DB.master.skills || []), ...(DB.user.customData.skills || [])]
            .sort((a,b) => a.name.localeCompare(b.name, 'ko'));
        
        const term = searchTerm.toLowerCase();
        const filteredAll = allSkills.filter(s => 
            !required.includes(s.skillId) && 
            !ignored.includes(s.skillId) &&
            s.name.toLowerCase().includes(term)
        );

        allSkillsListEl.innerHTML = filteredAll.map(s => `
            <div class="modal-skill-item" data-id="${s.skillId}">
                <span>${s.name}</span>
                <div class="actions">
                    <button data-action="add-required" title="필수 스킬로 추가">🔥</button>
                    <button data-action="add-ignored" title="무시할 스킬로 추가">🗑️</button>
                </div>
            </div>`).join('');
        
        requiredListEl.innerHTML = required.map(id => {
            const s = getSkillData(id);
            return s ? `<div class="modal-skill-item" data-id="${id}"><span>${s.name}</span><div class="actions"><button data-action="remove-required">❌</button></div></div>` : '';
        }).join('');

        ignoredListEl.innerHTML = ignored.map(id => {
            const s = getSkillData(id);
            return s ? `<div class="modal-skill-item" data-id="${id}"><span>${s.name}</span><div class="actions"><button data-action="remove-ignored">❌</button></div></div>` : '';
        }).join('');
    }

    // --- NEW: 데이터 내보내기/가져오기 (Phase 2) ---

    function getDependencies(item, type) {
        const customSkillIds = new Set();
        const allCustomSkillIds = (DB.user.customData.skills || []).map(s => s.skillId);

        const checkAndAdd = (skillId) => {
            if (skillId && allCustomSkillIds.includes(skillId)) {
                customSkillIds.add(skillId);
            }
        };

        if (type === 'customSc' || type === 'sc') {
            (item.hintSkills || []).forEach(checkAndAdd);
            (item.eventSkills || []).forEach(checkAndAdd);
        } else if (type === 'customInza' || type === 'inza') {
            Object.values(item.slots || {}).forEach(slot => {
                if (slot.green?.skillId) checkAndAdd(slot.green.skillId);
                (slot.skillFactors || []).forEach(checkAndAdd);
            });
        }
        
        const skills = (DB.user.customData.skills || []).filter(s => customSkillIds.has(s.skillId));
        return { skills };
    }

    function handleExportCollectionItem(btn) {
        const itemEl = btn.closest('.collection-item');
        const id = itemEl.dataset.id;
        const type = itemEl.dataset.type;
        
        let dataToExport, dataType, dependencies, fileName;
        
        if (type === 'customSkill') {
            dataType = 'customSkill';
            dataToExport = DB.user.customData.skills.find(s => s.skillId === id);
            dependencies = {};
        } else if (type === 'sc') {
            const userCard = DB.user.myCollection.supportCards.find(c => c.userCardId === id);
            const masterCard = findMasterSc(userCard.masterCardId);
            dataType = 'customSc';
            dataToExport = masterCard;
            dependencies = getDependencies(masterCard, 'customSc');
        } else if (type === 'inza') {
            const userInza = DB.user.myCollection.inzaCharacters.find(i => i.userInzaId === id);
            const masterInza = findMasterInza(userInza.masterInzaId);
            dataType = 'customInza';
            dataToExport = masterInza;
            dependencies = getDependencies(masterInza, 'customInza');
        }

        if (!dataToExport) {
            alert("내보낼 데이터를 찾을 수 없습니다.");
            return;
        }

        const exportObject = {
            dataType: 'UmaSkillChecker_IndividualExport',
            version: '1.5.0',
            data: { type: dataType, item: dataToExport },
            dependencies: dependencies
        };
        
        fileName = `uma_export_${dataType}_${dataToExport.name.replace(/\s/g, '_')}.json`;
        
        const dataStr = JSON.stringify(exportObject, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    function handleImportFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData.dataType !== 'UmaSkillChecker_IndividualExport') {
                    throw new Error('유효한 개별 데이터 파일이 아닙니다. (dataType 불일치)');
                }
                mergeImportedData(importedData);
            } catch (err) {
                console.error("개별 데이터 가져오기 오류:", err);
                alert(`오류: ${err.message}`);
            } finally {
                event.target.value = ''; // Reset input
            }
        };
        reader.readAsText(file);
    }

    function mergeImportedData(importedObject) {
        const { data, dependencies } = importedObject;
        let addedCount = { skills: 0, supportCards: 0, inzaCharacters: 0 };
        let skippedCount = { skills: 0, supportCards: 0, inzaCharacters: 0 };

        const mergeItem = (item, type) => {
            const collection = DB.user.customData[type];
            if (collection.some(existing => existing.name === item.name)) {
                skippedCount[type]++;
                return false;
            }
            collection.push(item);
            addedCount[type]++;
            return true;
        };

        // 1. 의존성 먼저 병합
        (dependencies.skills || []).forEach(skill => mergeItem(skill, 'skills'));

        // 2. 메인 데이터 병합
        const mainItem = data.item;
        const mainTypePlural = data.type === 'customSkill' ? 'skills' :
                               data.type === 'customSc' ? 'supportCards' : 'inzaCharacters';
        
        const wasMainItemAdded = mergeItem(mainItem, mainTypePlural);

        // 3. 컬렉션에 추가 (메인 아이템이 성공적으로 추가된 경우)
        if (wasMainItemAdded) {
            if (data.type === 'customSc') {
                DB.user.myCollection.supportCards.push({
                    userCardId: `user_sc_${Date.now()}`,
                    masterCardId: mainItem.masterCardId,
                    name: mainItem.name,
                    level: 4,
                    hintLevel: mainItem.hintLevel
                });
            } else if (data.type === 'customInza') {
                DB.user.myCollection.inzaCharacters.push({
                    userInzaId: `user_inza_${Date.now()}`,
                    masterInzaId: mainItem.masterInzaId,
                    name: mainItem.name
                });
            }
        }

        saveUserData();
        renderCollectionView('main', { activeTab: DB.user.userSettings.lastCollectionTab });

        let summary = '데이터 가져오기 완료!\n\n';
        const totalAdded = Object.values(addedCount).reduce((a, b) => a + b, 0);
        const totalSkipped = Object.values(skippedCount).reduce((a, b) => a + b, 0);
        
        summary += `✅ 추가된 항목: ${totalAdded}개\n`;
        if (totalSkipped > 0) {
            summary += `⚠️ 건너뛴 항목 (이름 중복): ${totalSkipped}개\n`;
        }
        alert(summary);
    }


    // --- 초기화 및 이벤트 리스너 설정 ---
    async function initialize() {
        DB.master = await loadMasterData();
        if (!DB.master) return;

        try {
            const userData = loadUserData();
            applyUserData(userData);
        } catch (error) {
            return;
        }
        
        renderAll();

        // 이벤트 리스너 설정
        themeToggle.addEventListener('click', toggleTheme);
        document.querySelector('.deck-slots-grid').addEventListener('change', handleDeckChange);
        resetSkillsBtn.addEventListener('click', handleResetClick);
        hideAcquiredToggle.addEventListener('change', e => { DB.user.userSettings.hideAcquired = e.target.checked; renderAll(); saveUserData(); });
        showDetailsToggle.addEventListener('change', e => { DB.user.userSettings.showDetails = e.target.checked; applyDetailsVisibility(e.target.checked); saveUserData(); });
        clickAreaToggle.addEventListener('change', e => { DB.user.userSettings.clickArea = e.target.checked ? 'full' : 'checkbox'; renderAll(); saveUserData(); });
        downloadBtn.addEventListener('click', () => { const dataStr = JSON.stringify(DB.user, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'uma-skill-userdata_full.json'; a.click(); URL.revokeObjectURL(url); });
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', handleUploadChange);
        resetDataBtn.addEventListener('click', handleResetDataClick);
        skillListContainer.addEventListener('click', handleSkillItemClick);
        acquiredSkillsContainer.addEventListener('click', handleSkillItemClick);
        targetBubblesContainer.addEventListener('click', handleTargetBubbleClick);
        importJsonInput.addEventListener('change', handleImportFileChange);
        
        manageCollectionBtn.addEventListener('click', () => {
            renderCollectionView('main', { activeTab: DB.user.userSettings.lastCollectionTab || 'sc' });
            collectionModal.style.display = 'flex';
        });
        collectionModal.querySelector('.modal-close-btn').addEventListener('click', () => {
            collectionModal.style.display = 'none';
            renderAll();
        });
        
        openTargetModalBtn.addEventListener('click', () => {
            renderTargetModalContent();
            targetModal.style.display = 'flex';
        });
        targetModal.querySelector('.modal-close-btn').addEventListener('click', () => targetModal.style.display = 'none');
        targetModal.querySelector('#modal-save-btn').addEventListener('click', () => {
            targetModal.style.display = 'none';
            saveUserData();
            renderAll();
        });
        targetModal.querySelector('#target-modal-body').addEventListener('click', handleTargetModalEvents);
        targetModal.querySelector('#modal-search').addEventListener('input', e => renderTargetModalContent(e.target.value));

        // 스킬 검색 모달 이벤트 리스너
        const skillSearchAllSkillsList = skillSearchModal.querySelector('#skill-search-all-skills .skill-list');
        const skillSearchSelectedSkillsList = skillSearchModal.querySelector('#skill-search-selected-skills .skill-list');
        
        skillSearchAllSkillsList.addEventListener('click', handleSkillSearchModalClick);
        skillSearchSelectedSkillsList.addEventListener('click', handleSkillSearchModalClick);
        document.getElementById('skill-search-input').addEventListener('input', e => renderSkillSearchModal(e.target.value));
        document.getElementById('skill-search-confirm-btn').addEventListener('click', () => {
            if (currentSkillTextarea) {
                const allSkills = [...DB.master.skills, ...(DB.user.customData.skills || [])];
                const selectedNames = [...skillSearchSelectedIds].map(id => allSkills.find(s => s.skillId === id)?.name).filter(Boolean);
                currentSkillTextarea.value = selectedNames.join('\n');
            }
            skillSearchModal.style.display = 'none';
        });
        skillSearchModal.querySelector('.modal-close-btn').addEventListener('click', () => skillSearchModal.style.display = 'none');
        document.getElementById('skill-search-cancel-btn').addEventListener('click', () => skillSearchModal.style.display = 'none');
    }

    initialize();
});