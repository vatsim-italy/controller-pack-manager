use std::fmt;

#[derive(Debug, Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ListColumn {
    pub values: Vec<String>,
}

#[derive(Debug, Clone, Default, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ListConfig {
    pub id: String,
    pub visible: bool,
    pub x: u16,
    pub y: u16,
    pub line_number: u16,
    pub resizable: bool,
    pub ordered_by_index: u16,
    pub header_only: bool,
    pub columns: Vec<ListColumn>,
}

#[derive(Debug, Clone, Default, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ControllerListConfig {
    pub visible: bool,
    pub x: u16,
    pub y: u16,
    pub fss: bool,
    pub ctr: bool,
    pub app: bool,
    pub twr: bool,
    pub gnd: bool,
    pub atis: bool,
    pub obs: bool,
}

#[derive(Debug, Clone, Default, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct TitleBarConfig {
    pub visible: bool,
    pub file_name: bool,
    pub controller_name: bool,
    pub primary_frequency: bool,
    pub atis_frequency: bool,
    pub clock: bool,
    pub leader: bool,
    pub filter: bool,
    pub transition_level: bool,
}

#[derive(Debug, Clone, Default, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MetarListConfig {
    pub visible: bool,
    pub x: u16,
    pub y: u16,
    pub title: bool,
}

#[derive(Debug, Clone, Default, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct DisplayConfig {
    pub id: u16,
    pub position: u16,
    pub maximized: bool,
}

#[derive(Debug, Clone, Default, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ScreenConfig {
    pub controller_list: ControllerListConfig,
    pub metar_list: MetarListConfig,
    pub title_bar: TitleBarConfig,
    pub display_config: DisplayConfig,
    pub connect_sel_to_sil: bool,
    pub connect_dep_to_sel: bool,
    pub connect_sil_to_top: bool,
    pub source: String,
}

impl ControllerListConfig {
    pub fn parse(content: &str) -> Result<Self, String> {
        let mut config = Self::default();

        for line in content.lines() {
            let parts: Vec<&str> = line.split(':').map(|part| part.trim()).collect();
            if parts.len() < 2 {
                continue;
            }

            let key = parts[0];
            let value = parts[1];

            match key {
                "m_ShowControllers" => config.visible = value == "1",
                "m_ShowFSSControllers" => config.fss = value == "1",
                "m_ShowCTRControllers" => config.ctr = value == "1",
                "m_ShowAPPControllers" => config.app = value == "1",
                "m_ShowTWRControllers" => config.twr = value == "1",
                "m_ShowGNDControllers" => config.gnd = value == "1",
                "m_ShowATISControllers" => config.atis = value == "1",
                "m_ShowOBSControllers" => config.obs = value == "1",
                "m_ControllerListX" => config.x = parse_u16(value)?,
                "m_ControllerListY" => config.y = parse_u16(value)?,
                _ => {}
            }
        }

        Ok(config)
    }
}

impl fmt::Display for ControllerListConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "m_ShowControllers:{}\n\
            m_ShowFSSControllers:{}\n\
            m_ShowCTRControllers:{}\n\
            m_ShowAPPControllers:{}\n\
            m_ShowTWRControllers:{}\n\
            m_ShowGNDControllers:{}\n\
            m_ShowATISControllers:{}\n\
            m_ShowOBSControllers:{}\n\
            m_ControllerListX:{}\n\
            m_ControllerListY:{}\n",
            self.visible as u8,
            self.fss as u8,
            self.ctr as u8,
            self.app as u8,
            self.twr as u8,
            self.gnd as u8,
            self.atis as u8,
            self.obs as u8,
            self.x,
            self.y,
        )
    }
}

impl TitleBarConfig {
    pub fn parse(content: &str) -> Result<Self, String> {
        let mut config = Self::default();

        for line in content.lines() {
            let parts: Vec<&str> = line.split(':').map(|part| part.trim()).collect();
            if parts.len() < 2 {
                continue;
            }

            let key = parts[0];
            let value = parts[1];

            match key {
                "m_ShowTitle" => config.visible = value == "1",
                "m_ShowTitleFileName" => config.file_name = value == "1",
                "m_ShowTitleController" => config.controller_name = value == "1",
                "m_ShowTitlePrimaryFreq" => config.primary_frequency = value == "1",
                "m_ShowTitleAtisFreq" => config.atis_frequency = value == "1",
                "m_ShowTitleClock" => config.clock = value == "1",
                "m_ShowTitleLeader" => config.leader = value == "1",
                "m_ShowTitleFilter" => config.filter = value == "1",
                "m_ShowTitleTrans" => config.transition_level = value == "1",
                _ => {}
            }
        }

        Ok(config)
    }
}

impl fmt::Display for TitleBarConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "m_ShowTitle:{}\n\
            m_ShowTitleFileName:{}\n\
            m_ShowTitleController:{}\n\
            m_ShowTitlePrimaryFreq:{}\n\
            m_ShowTitleAtisFreq:{}\n\
            m_ShowTitleClock:{}\n\
            m_ShowTitleLeader:{}\n\
            m_ShowTitleFilter:{}\n\
            m_ShowTitleTrans:{}\n",
            self.visible as u8,
            self.file_name as u8,
            self.controller_name as u8,
            self.primary_frequency as u8,
            self.atis_frequency as u8,
            self.clock as u8,
            self.leader as u8,
            self.filter as u8,
            self.transition_level as u8,
        )
    }
}

impl MetarListConfig {
    pub fn parse(content: &str) -> Result<Self, String> {
        let mut config = Self::default();

        for line in content.lines() {
            let parts: Vec<&str> = line.split(':').map(|part| part.trim()).collect();
            if parts.len() < 2 {
                continue;
            }

            let key = parts[0];
            let value = parts[1];

            match key {
                "m_METARList" => config.visible = value == "1",
                "m_ShowTitleMetar" => config.title = value == "1",
                "m_MetarListX" => config.x = parse_u16(value)?,
                "m_MetarListY" => config.y = parse_u16(value)?,
                _ => {}
            }
        }

        Ok(config)
    }
}

impl fmt::Display for MetarListConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "m_METARList:{}\n\
            m_ShowTitleMetar:{}\n\
            m_MetarListX:{}\n\
            m_MetarListY:{}\n",
            self.visible as u8, self.title as u8, self.x, self.y,
        )
    }
}

impl DisplayConfig {
    pub fn parse(content: &str) -> Result<Self, String> {
        let mut config = Self::default();

        for line in content.lines() {
            let parts: Vec<&str> = line.split(':').map(|part| part.trim()).collect();
            if parts.len() < 2 {
                continue;
            }

            let key = parts[0];
            let value = parts[1];

            match key {
                "m_ScreenNumber" => config.id = parse_u16(value)?,
                "m_ScreenPosition" => config.position = parse_u16(value)?,
                "m_ScreenMaximized" => config.maximized = value == "1",
                _ => {}
            }
        }

        Ok(config)
    }
}

impl fmt::Display for DisplayConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "m_ScreenNumber:{}\n\
            m_ScreenPosition:{}\n\
            m_ScreenMaximized:{}\n",
            self.id, self.position, self.maximized as u8,
        )
    }
}

impl ScreenConfig {
    pub fn parse(content: &str) -> Result<Self, String> {
        let mut config = Self {
            controller_list: ControllerListConfig::parse(content)?,
            metar_list: MetarListConfig::parse(content)?,
            title_bar: TitleBarConfig::parse(content)?,
            display_config: DisplayConfig::parse(content)?,
            source: content.to_string(),
            ..Default::default()
        };

        for line in content.lines() {
            let parts: Vec<&str> = line.split(':').map(|part| part.trim()).collect();
            if parts.len() < 2 {
                continue;
            }

            let key = parts[0];
            let value = parts[1];

            match key {
                "m_ConnectSELtoSIL" => config.connect_sel_to_sil = value == "1",
                "m_ConnectDEPtoSEL" => config.connect_dep_to_sel = value == "1",
                "m_ConnectSILtoTOP" => config.connect_sil_to_top = value == "1",
                _ => {}
            }
        }

        Ok(config)
    }
}

impl fmt::Display for ScreenConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let output = format!(
            "{}\n\
            {}\n\
            {}\n\
            {}\n\
            m_ConnectSELtoSIL:{}\n\
            m_ConnectDEPtoSEL:{}\n\
            m_ConnectSILtoTOP:{}\n",
            self.controller_list,
            self.metar_list,
            self.title_bar,
            self.display_config,
            self.connect_sel_to_sil as u8,
            self.connect_dep_to_sel as u8,
            self.connect_sil_to_top as u8,
        );

        let written_keys: Vec<&str> = output
            .lines()
            .map(|line| {
                line.split(':')
                    .map(|part| part.trim())
                    .nth(0)
                    .expect("we literally just constructed it")
            })
            .collect();

        let untouched_lines: Vec<&str> = self
            .source
            .lines()
            .filter(|line| {
                let key = line
                    .split(':')
                    .map(|part| part.trim())
                    .nth(0)
                    .expect("we literally just parsed it");

                !written_keys.contains(&key)
            })
            .collect();

        write!(f, "{}{}\n", output, untouched_lines.join("\n"))
    }
}

impl ListColumn {
    pub fn parse(content: &str) -> Result<Self, String> {
        let components: Vec<String> = content
            .split(':')
            .skip(1)
            .map(|part| part.trim().to_string())
            .collect();
        if components.len() < 4 {
            return Err("not enough information to parse list column config".to_string());
        }

        Ok(Self { values: components })
    }

    pub fn id(&self) -> String {
        self.values[0].to_string()
    }

    pub fn visible(&self) -> bool {
        self.values[2] == "1"
    }

    pub fn set_visibility(&mut self, visible: bool) {
        self.values[2] = if visible { "1" } else { "0" }.to_string();
    }

    pub fn as_line(&self) -> String {
        format!("m_Column:{}", self.values.join(":")).to_string()
    }
}

impl fmt::Display for ListColumn {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "m_Column:{}", self.values.join(":"))
    }
}

impl ListConfig {
    // Content here is a piece of text bounded by LISTID - ... - END
    pub fn parse(content: &str) -> Result<Self, String> {
        let mut lines = content.lines();
        let list_id = lines.next().ok_or("no list id found")?;

        let mut config = ListConfig {
            id: list_id.to_string(),
            ..Default::default()
        };

        let mut columns: Vec<ListColumn> = vec![];
        while let Some(line) = lines.next() {
            if line == "END" {
                break;
            }

            let components: Vec<&str> = line.split(":").collect();
            if components.len() == 2 {
                let key = components[0].trim();
                let value = components[1].trim();

                match key {
                    "m_Visible" => config.visible = value == "1",
                    "m_X" => config.x = parse_u16(value)?,
                    "m_Y" => config.y = parse_u16(value)?,
                    "m_LineNumber" => config.line_number = parse_u16(value)?,
                    "m_Resizable" => config.resizable = value == "1",
                    "m_OrderingColumn" => config.ordered_by_index = parse_u16(value)?,
                    "m_HeaderOnly" => config.header_only = value == "1",
                    _ => {
                        eprintln!("error: unknown key in list configuration: {}", key)
                    }
                }
            } else if components.len() >= 1 {
                let key = components[0].trim();

                match key {
                    "m_Column" => columns.push(ListColumn::parse(line)?),
                    _ => {
                        eprintln!("info: unknown key in list configuration: {}", key)
                    }
                }
            }
        }

        config.columns = columns;
        Ok(config)
    }
}

impl fmt::Display for ListConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let columns: String = self
            .columns
            .iter()
            .map(|column| format!("{}", column))
            .collect::<Vec<_>>()
            .join("\n");

        write!(f, "{}\nm_Visible:{}\nm_X:{}\nm_Y:{}\nm_LineNumber:{}\nm_Resizable:{}\nm_OrderingColumn:{}\nm_HeaderOnly:{}\n{}\nEND",
                self.id, self.visible as u8, self.x, self.y, self.line_number, self.resizable as u8, self.ordered_by_index, self.header_only as u8, columns)
    }
}

fn parse_u16(str: &str) -> Result<u16, String> {
    str.parse::<u16>()
        .map_err(|_| "unable to parse number".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    pub fn parse_column() {
        let content = "m_Column:ARCID:8:1:9:8:0:1::::7:0.0";
        let column = ListColumn::parse(content).unwrap();
        assert_eq!(
            column,
            ListColumn {
                values: vec![
                    "ARCID".to_string(),
                    "8".to_string(),
                    "1".to_string(),
                    "9".to_string(),
                    "8".to_string(),
                    "0".to_string(),
                    "1".to_string(),
                    "".to_string(),
                    "".to_string(),
                    "".to_string(),
                    "7".to_string(),
                    "0.0".to_string(),
                ],
            }
        );
    }

    #[test]
    pub fn parse_list_config() {
        let content = r"STUP
                m_Visible:1
                m_X:0
                m_Y:45
                m_LineNumber:0
                m_Resizable:1
                m_OrderingColumn:21
                m_HeaderOnly:0
                m_Column:ARCID:8:1:9:8:0:1::::7:0.0
                m_Column:FR:2:1:63:0:0:1::::7:0.0
                m_Column:ATYP:4:1:16:0:0:1::::7:4.0
                m_Column:PKB:5:1:1:0:0:1:Ground Radar plugin:::4:0.0
                m_Column:EOBT:5:1:1:120:100:1:CDM Plugin:CDM Plugin:CDM Plugin:1:0.0
                m_Column:TOBT:5:1:4:121:114:1:CDM Plugin:CDM Plugin:CDM Plugin:1:0.0
                m_Column:TSAT:5:1:2:0:0:1:CDM Plugin:::1:0.0
                m_Column:ASRT:5:1:7:107:0:1:CDM Plugin:CDM Plugin::0:0.0
                m_Column:CTOT:5:1:10:108:0:1:CDM Plugin:CDM Plugin::1:0.0
                m_Column:TTOT:5:1:3:0:0:1:CDM Plugin:::1:0.0
                m_Column:ADES:5:1:17:7:1001:1:::TopSky plugin:3:4.0
                m_Column:ICP:8:1:641:741:742:1:vSID:vSID:vSID:6:4.0
                m_Column:TSE:8:1:647:741:746:1:vSID:vSID:vSID:0:4.0
                m_Column:DRW:3:1:642:743:743:1:vSID:vSID:vSID:7:0.0
                m_Column:ALV:4:1:640:740:740:1:vSID:vSID:vSID:3:4.0
                m_Column:ASSR:5:1:643:940:62:1:vSID:vSID:TopSky plugin:0:4.0
                m_Column:PLV:4:1:22:30:30:1::::3:0.0
                m_Column:V:4:1:10085:155:0:1:TopSky plugin:TopSky plugin::0:0.0
                m_Column:REQ:3:1:644:744:744:1:vSID:vSID:vSID:7:0.0
                m_Column:C:1:1:648:27:0:1:vSID:::3:4.0
                m_Column:R:3:1:519:405:406:1:VATITA Controller Plugin:VATITA Controller Plugin:VATITA Controller Plugin:3:4.0
                m_Column:INT:3:1:649:750:749:1:vSID:vSID:vSID:0:0.0
                m_Column:STS:5:1:3:13:13:1:Ground Radar plugin:Ground Radar plugin:Ground Radar plugin:8:0.0
                m_Column:RMK:10:1:19:29:29:1::::7:0.0
                END
                ";

        let list_config = ListConfig::parse(content).unwrap();

        let expected_ids = vec![
            "ARCID", "FR", "ATYP", "PKB", "EOBT", "TOBT", "TSAT", "ASRT", "CTOT", "TTOT", "ADES",
            "ICP", "TSE", "DRW", "ALV", "ASSR", "PLV", "V", "REQ", "C", "R", "INT", "STS", "RMK",
        ];

        let expected_columns: Vec<ListColumn> = expected_ids
            .into_iter()
            .map(|id| {
                let line = content
                    .lines()
                    .find(|line| line.contains(&format!("m_Column:{id}:")))
                    .unwrap()
                    .trim();
                ListColumn::parse(line).unwrap()
            })
            .collect();

        assert_eq!(
            list_config,
            ListConfig {
                id: "STUP".to_string(),
                visible: true,
                x: 0,
                y: 45,
                line_number: 0,
                resizable: true,
                ordered_by_index: 21,
                header_only: false,
                columns: expected_columns,
            }
        );
    }

    #[test]
    pub fn parse_multiple_list_config() {
        let content = r"SIL
                m_Visible:0
                m_X:1312
                m_Y:145
                m_LineNumber:0
                m_Resizable:1
                m_OrderingColumn:1
                m_HeaderOnly:0
                m_Column::1:1:10057:0:0:1:TopSky plugin:::0:0.0
                m_Column:FIX:6:1:10004:21:99:1:TopSky plugin::TopSky plugin:9:0.0
                m_Column:ETO:4:0:10034:0:32:1:TopSky plugin:::9:0.0
                m_Column:ARCID:9:0:10021:6:33:1:TopSky plugin:TopSky plugin::9:0.0
                m_Column:ASSR:5:1:10023:62:62:1:TopSky plugin:TopSky plugin:TopSky plugin:9:0.0
                m_Column:PLV:4:1:10006:59:59:1:TopSky plugin:TopSky plugin:TopSky plugin:9:0.0
                m_Column:PEL:4:1:10001:68:68:1:TopSky plugin:TopSky plugin:TopSky plugin:9:0.0
                m_Column:TYPE:5:1:10028:0:0:1:TopSky plugin:::9:0.0
                m_Column:DEP:5:0:10007:1001:1001:1:TopSky plugin:TopSky plugin:TopSky plugin:9:0.0
                m_Column:DEST:5:0:10008:1001:1001:1:TopSky plugin:TopSky plugin:TopSky plugin:9:0.0
                m_Column:ROUTE:6:0:233:0:0:1:TopSky plugin:::9:0.0
                m_Column:R:2:1:202:0:0:1:TopSky plugin:::9:0.0
                END
                SEL
                m_Visible:0
                m_X:1312
                m_Y:177
                m_LineNumber:0
                m_Resizable:1
                m_OrderingColumn:4
                m_HeaderOnly:0
                m_Column::1:1:10057:0:0:1:TopSky plugin:::0:0.0
                m_Column:FIX:6:1:10005:22:99:1:TopSky plugin::TopSky plugin:1:0.0
                m_Column:ETO:4:0:10092:0:0:1:TopSky plugin:::1:0.0
                m_Column:ARCID:9:0:10021:6:33:1:TopSky plugin:TopSky plugin::0:0.0
                m_Column:ASSR:5:1:10023:62:62:1:TopSky plugin:TopSky plugin:TopSky plugin:0:0.0
                m_Column:PLV:4:1:10006:59:59:1:TopSky plugin:TopSky plugin:TopSky plugin:0:0.0
                m_Column:XFL:4:1:10003:105:105:1:TopSky plugin:TopSky plugin:TopSky plugin:1:0.0
                m_Column:TYPE:5:0:10028:0:0:1:TopSky plugin:::1:0.0
                m_Column:DEP:5:0:10007:1001:1001:1:TopSky plugin:TopSky plugin:TopSky plugin:1:0.0
                m_Column:DEST:5:0:10008:1001:1001:1:TopSky plugin:TopSky plugin:TopSky plugin:0:0.0
                END
                ";

        let list_configs: Vec<ListConfig> = content
            .split("END")
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|block| ListConfig::parse(block).unwrap())
            .collect();

        let sil_cols = vec![
            ("", true),
            ("FIX", true),
            ("ETO", false),
            ("ARCID", false),
            ("ASSR", true),
            ("PLV", true),
            ("PEL", true),
            ("TYPE", true),
            ("DEP", false),
            ("DEST", false),
            ("ROUTE", false),
            ("R", true),
        ];

        let sel_cols = vec![
            ("", true),
            ("FIX", true),
            ("ETO", false),
            ("ARCID", false),
            ("ASSR", true),
            ("PLV", true),
            ("XFL", true),
            ("TYPE", false),
            ("DEP", false),
            ("DEST", false),
        ];

        assert_eq!(list_configs.len(), 2);

        assert_eq!(list_configs[0].id, "SIL");
        assert_eq!(list_configs[0].y, 145);
        assert_eq!(
            list_configs[0].columns,
            sil_cols
                .into_iter()
                .map(|(id, v)| {
                    list_configs[0]
                        .columns
                        .iter()
                        .find(|column| column.values[0] == id)
                        .map(|column| {
                            let mut expected = column.clone();
                            expected.set_visibility(v);
                            expected
                        })
                        .unwrap()
                })
                .collect::<Vec<_>>()
        );

        assert_eq!(list_configs[1].id, "SEL");
        assert_eq!(list_configs[1].y, 177);
        assert_eq!(
            list_configs[1].columns,
            sel_cols
                .into_iter()
                .map(|(id, v)| {
                    list_configs[1]
                        .columns
                        .iter()
                        .find(|column| column.values[0] == id)
                        .map(|column| {
                            let mut expected = column.clone();
                            expected.set_visibility(v);
                            expected
                        })
                        .unwrap()
                })
                .collect::<Vec<_>>()
        );
    }

    #[test]
    pub fn update_visibility_preserves_other_values() {
        let content = "m_Column:ARCID:8:1:9:8:0:1::::0:0.0";
        let mut column = ListColumn::parse(content).unwrap();

        column.set_visibility(false);
        assert_eq!(column.visible(), false);
        assert_eq!(column.as_line(), "m_Column:ARCID:8:0:9:8:0:1::::0:0.0");

        column.set_visibility(true);
        assert_eq!(column.visible(), true);
        assert_eq!(column.as_line(), "m_Column:ARCID:8:1:9:8:0:1::::0:0.0");
    }

    #[test]
    pub fn list_config_to_string() {
        let content = r"ADCS
                        m_Visible:1
                        m_X:1848
                        m_Y:463
                        m_LineNumber:6
                        m_Resizable:0
                        m_OrderingColumn:1
                        m_HeaderOnly:0
                        m_Column:ARCID:8:1:9:8:0:1::::0:0.0
                        m_Column:SSR:5:1:2:62:62:1::TopSky plugin:TopSky plugin:7:0.0
                        m_Column:ARW:4:1:47:19:19:1::::7:0.0
                        m_Column:PKB:5:1:2:1:1:1:Ground Radar plugin:Ground Radar plugin:Ground Radar plugin:1:0.0
                        m_Column:ATYP:4:1:16:0:0:1::::7:4.0
                        m_Column:ETL:4:1:10033:0:0:1:TopSky plugin:::7:0.0
                        m_Column:STS:5:1:3:13:13:1:Ground Radar plugin:Ground Radar plugin:Ground Radar plugin:8:4.0
                        END";

        let config = ListConfig::parse(content).unwrap();
        let expected = content
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        assert_eq!(format!("{}", config), expected);
    }

    #[test]
    pub fn parse_screen_settings() {
        let content = r"m_ShowControllers:1
                        m_ShowAircraft:0
                        m_ShowTextMessages:0
                        m_ShowTitle:1
                        m_ShowTitleFileName:1
                        m_ShowTitleController:1
                        m_ShowTitlePrimaryFreq:1
                        m_ShowTitleAtisFreq:0
                        m_ShowTitleClock:1
                        m_ShowTitleLeader:1
                        m_ShowTitleFilter:1
                        m_ShowTitleTrans:1
                        m_ShowVoiceRoomUsers:0
                        m_ShowFSSControllers:1
                        m_ShowCTRControllers:1
                        m_ShowAPPControllers:1
                        m_ShowTWRControllers:1
                        m_ShowGNDControllers:1
                        m_ShowATISControllers:0
                        m_ShowOBSControllers:1
                        m_ShowUnidentifiedControllers:0
                        m_ShowFreqUsers:1
                        m_ShowAtisUsers:1
                        m_ShowArrivalPlanes:1
                        m_ShowDeparturePlanes:1
                        m_ShowOverflightPlanes:1
                        SET_ShowTrackingPlanes:1
                        m_METARList:1
                        m_ShowTitleMetar:0
                        m_ConnectSELtoSIL:1
                        m_ConnectDEPtoSEL:1
                        m_ConnectSILtoTOP:0
                        m_ScreenNumber:1
                        m_ScreenPosition:0
                        m_ScreenMaximized:0
                        m_ShowTitleSelectedAc:1
                        m_PlanesListX:4
                        m_PlanesListY:398
                        m_MetarListX:1598
                        m_MetarListY:56
                        m_VoiceListX:959
                        m_VoiceListY:83
                        m_ControllerListX:1727
                        m_ControllerListY:55
                        m_ShowPlaneRangeRingsTracked:0
                        m_ShowPlaneRangeRingsUntracked:0
                        m_PlaneRangeRingsDistance1:1.5
                        m_PlaneRangeRingsDistance2:2.5
                        m_PlaneRangeRingsDistance3:5.0
                        m_PlaneRangeRingsDistance4:0.0
                        m_ShowTooltips:1
                        m_OnTheGroundAltitude:5000
                        m_OnTheGroundSpeed:50
                        m_ShowCdtOnCflCheck:0
                        m_ShowTsVccsMiniControl:1
                        ScenarioEditorX:731
                        ScenarioEditorY:227
                        m_ShowSTARControllers:1
                        ";

        let screen_config = ScreenConfig::parse(content).unwrap();
        let formatted = format!("{}", screen_config);

        // Extract key-value pairs from original content
        let original_pairs: std::collections::HashMap<String, String> = content
            .lines()
            .filter_map(|line| {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    return None;
                }
                if let Some(colon_pos) = trimmed.find(':') {
                    let key = trimmed[..colon_pos].to_string();
                    let value = trimmed[colon_pos + 1..].to_string();
                    Some((key, value))
                } else {
                    None
                }
            })
            .collect();

        // Extract key-value pairs from formatted content
        let formatted_pairs: std::collections::HashMap<String, String> = formatted
            .lines()
            .filter_map(|line| {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    return None;
                }
                if let Some(colon_pos) = trimmed.find(':') {
                    let key = trimmed[..colon_pos].to_string();
                    let value = trimmed[colon_pos + 1..].to_string();
                    Some((key, value))
                } else {
                    None
                }
            })
            .collect();

        // Verify all original key-value pairs are present in formatted output
        for (key, value) in &original_pairs {
            assert_eq!(
                formatted_pairs.get(key),
                Some(value),
                "Key-value mismatch for key '{}': expected '{}', got '{:?}'",
                key,
                value,
                formatted_pairs.get(key)
            );
        }

        // Verify no extra key-value pairs in formatted output
        for (key, _) in &formatted_pairs {
            assert!(
                original_pairs.contains_key(key),
                "Extra key found in formatted output: '{}'",
                key
            );
        }

        // Verify no duplicate keys in formatted output (HashMap guarantees this, but verify the counts match)
        assert_eq!(
            original_pairs.len(),
            formatted_pairs.len(),
            "Number of key-value pairs mismatch: original has {}, formatted has {}",
            original_pairs.len(),
            formatted_pairs.len()
        );
    }
}
