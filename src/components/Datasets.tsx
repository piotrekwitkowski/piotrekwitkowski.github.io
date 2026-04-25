import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
  SpaceBetween,
  Link,
  Table,
  Badge,
  Box,
} from "@cloudscape-design/components";
import { AppLayout } from "./AppLayout";
import { SideNav } from "./SideNav";
import { DATASETS } from "../config/datasets";

function Datasets() {
  return (
    <AppLayout
      breadcrumbs={
        <BreadcrumbGroup
          items={[
            { text: "Home", href: "/" },
            { text: "Datasets", href: "/datasets" },
          ]}
        />
      }
      navigation={<SideNav activeHref="/datasets" />}
      content={
        <ContentLayout
          header={<Header variant="h1">Datasets</Header>}
        >
          <SpaceBetween size="l">
            <Table
              columnDefinitions={[
                {
                  id: "name",
                  header: "Name",
                  cell: (item) => (
                    <Link href={item.href}>{item.name}</Link>
                  ),
                },
                {
                  id: "format",
                  header: "Format",
                  cell: (item) => (
                    <Badge color={item.format === "JSON" ? "blue" : "grey"}>
                      {item.format}
                    </Badge>
                  ),
                },
                {
                  id: "description",
                  header: "Description",
                  cell: (item) => item.description,
                },
              ]}
              items={[...DATASETS].sort((a, b) => a.name.localeCompare(b.name))}
              variant="embedded"
              empty={
                <Box textAlign="center" color="text-body-secondary" padding="l">
                  No datasets available.
                </Box>
              }
            />
          </SpaceBetween>
        </ContentLayout>
      }
      />
  );
}

export default Datasets;
